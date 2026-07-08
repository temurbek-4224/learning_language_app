"use server";

import { ActivityType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentStudent } from "@/lib/student-auth";

type AnswerLogWithoutProgressId = Omit<
  Prisma.StudentAnswerLogCreateManyInput,
  "progressId"
>;

type LessonAnswerInput = {
  wordId: string;
  activity:
    | typeof ActivityType.TRANSLATION_QUIZ
    | typeof ActivityType.DEFINITION_TYPING
    | typeof ActivityType.EXAMPLE;
  answer: string;
  round: 1 | 2;
};

type CompleteLessonInput = {
  lessonId: string;
  studyWordIds: string[];
  attempts: LessonAnswerInput[];
};

export type CompleteLessonResult = {
  ok: boolean;
  message: string;
};

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function completeLesson(
  input: CompleteLessonInput,
): Promise<CompleteLessonResult> {
  const student = await getCurrentStudent();

  if (!student) {
    return { ok: false, message: "Avval Telegram Mini App orqali kiring." };
  }

  const lesson = await prisma.classLesson.findFirst({
    where: {
      id: input.lessonId,
      assignment: {
        classRoom: {
          members: {
            some: { studentId: student.id },
          },
        },
      },
    },
    include: {
      assignment: { select: { id: true } },
      words: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          term: true,
          translation: true,
          definition: true,
          example: true,
        },
      },
    },
  });

  if (!lesson) {
    return { ok: false, message: "Bu lesson sizga tegishli emas." };
  }

  if (lesson.words.length === 0) {
    return { ok: false, message: "Bu lessonda hali so'zlar yo'q." };
  }

  if (lesson.sortOrder > 1) {
    const previousLesson = await prisma.classLesson.findFirst({
      where: {
        classAssignmentId: lesson.classAssignmentId,
        sortOrder: lesson.sortOrder - 1,
      },
      select: {
        progress: {
          where: { studentId: student.id, status: "COMPLETED" },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!previousLesson?.progress.length) {
      return { ok: false, message: "Avval oldingi lessonni yakunlang." };
    }
  }

  const wordsById = new Map(lesson.words.map((word) => [word.id, word]));
  const allowedActivities = new Set<ActivityType>([
    ActivityType.TRANSLATION_QUIZ,
    ActivityType.DEFINITION_TYPING,
    ActivityType.EXAMPLE,
  ]);

  const activeWords = Array.from(new Set(input.studyWordIds))
    .map((wordId) => wordsById.get(wordId))
    .filter((word): word is NonNullable<typeof word> => Boolean(word));

  if (activeWords.length === 0) {
    return { ok: false, message: "Bu lessonda ishlash uchun so'z topilmadi." };
  }

  const exerciseActivities = [
    ActivityType.TRANSLATION_QUIZ,
    ActivityType.DEFINITION_TYPING,
    ActivityType.EXAMPLE,
  ] as const;
  const activeWordIds = new Set(activeWords.map((word) => word.id));
  const attemptedStepWords = new Set(
    input.attempts
      .filter((attempt) => activeWordIds.has(attempt.wordId))
      .map((attempt) => `${attempt.activity}:${attempt.wordId}`),
  );
  const hasAllRequiredAttempts = activeWords.every((word) =>
    exerciseActivities.every((activity) =>
      attemptedStepWords.has(`${activity}:${word.id}`),
    ),
  );

  if (!hasAllRequiredAttempts) {
    return {
      ok: false,
      message: "Mashqlar to'liq yakunlanmadi. Iltimos, qayta urinib ko'ring.",
    };
  }

  const studyLogs = activeWords.map(
    (word): AnswerLogWithoutProgressId => ({
      studentId: student.id,
      classLessonWordId: word.id,
      activity: ActivityType.STUDY_CARDS,
      prompt: word.term,
      expectedAnswer: word.term,
      submittedAnswer: "viewed",
      isCorrect: true,
    }),
  );

  const exerciseLogs = input.attempts
    .filter(
      (attempt) =>
        activeWordIds.has(attempt.wordId) &&
        allowedActivities.has(attempt.activity),
    )
    .map((attempt) => {
      const word = wordsById.get(attempt.wordId)!;
      const expectedAnswer =
        attempt.activity === ActivityType.TRANSLATION_QUIZ
          ? word.translation
          : word.term;
      const prompt =
        attempt.activity === ActivityType.TRANSLATION_QUIZ
          ? word.term
          : attempt.activity === ActivityType.DEFINITION_TYPING
          ? `${word.definition || "Definition"} | ${word.translation}`
          : word.example || word.term;

      return {
        studentId: student.id,
        classLessonWordId: word.id,
        activity: attempt.activity,
        prompt: `${prompt} (chance ${attempt.round})`,
        expectedAnswer,
        submittedAnswer: attempt.answer,
        isCorrect:
          normalizeAnswer(attempt.answer) === normalizeAnswer(expectedAnswer),
      } satisfies AnswerLogWithoutProgressId;
    });

  const latestByStepWord = new Map<string, (typeof exerciseLogs)[number]>();
  for (const log of exerciseLogs) {
    latestByStepWord.set(`${log.activity}:${log.classLessonWordId}`, log);
  }

  const failedWordIds = new Set<string>();
  for (const log of latestByStepWord.values()) {
    if (!log.isCorrect && log.classLessonWordId) {
      failedWordIds.add(log.classLessonWordId);
    }
  }

  const correctWords = Math.max(lesson.words.length - failedWordIds.size, 0);
  const accuracy = Math.round((correctWords / lesson.words.length) * 100);
  const logs = [...studyLogs, ...exerciseLogs];
  const completedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const progress = await tx.studentLessonProgress.upsert({
        where: {
          studentId_classLessonId: {
            studentId: student.id,
            classLessonId: lesson.id,
          },
        },
        create: {
          studentId: student.id,
          classLessonId: lesson.id,
          status: "COMPLETED",
          score: accuracy,
          startedAt: completedAt,
          completedAt,
        },
        update: {
          status: "COMPLETED",
          score: accuracy,
          completedAt,
        },
      });

      await tx.studentAnswerLog.deleteMany({
        where: { progressId: progress.id },
      });

      await tx.studentAnswerLog.createMany({
        data: logs.map((log) => ({
          ...log,
          progressId: progress.id,
        })),
      });
    });
  } catch {
    return {
      ok: false,
      message: "Progress saqlanmadi. Iltimos, qayta urinib ko'ring.",
    };
  }

  revalidatePath("/app");
  revalidatePath(`/app/assignments/${lesson.assignment.id}`);
  revalidatePath(`/app/lessons/${lesson.id}`);

  return { ok: true, message: "Lesson yakunlandi." };
}
