"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentStudent } from "@/lib/student-auth";

type LessonAnswerInput = {
  wordId: string;
  answer: string;
};

type CompleteLessonInput = {
  lessonId: string;
  quizAnswers: LessonAnswerInput[];
  typingAnswers: LessonAnswerInput[];
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

  const quizAnswers = new Map(
    input.quizAnswers.map((answer) => [answer.wordId, answer.answer]),
  );
  const typingAnswers = new Map(
    input.typingAnswers.map((answer) => [answer.wordId, answer.answer]),
  );

  const logs = lesson.words.flatMap((word) => {
    const quizAnswer = quizAnswers.get(word.id) ?? "";
    const typingAnswer = typingAnswers.get(word.id) ?? "";
    const expected = word.translation;

    return [
      {
        studentId: student.id,
        classLessonWordId: word.id,
        activity: "TRANSLATION_QUIZ" as const,
        prompt: `${word.term} so'zining tarjimasi qaysi?`,
        expectedAnswer: expected,
        submittedAnswer: quizAnswer,
        isCorrect: normalizeAnswer(quizAnswer) === normalizeAnswer(expected),
      },
      {
        studentId: student.id,
        classLessonWordId: word.id,
        activity: "DEFINITION_TYPING" as const,
        prompt: word.definition
          ? `${word.term}: ${word.definition}`
          : `${word.term} so'zining tarjimasini yozing.`,
        expectedAnswer: expected,
        submittedAnswer: typingAnswer,
        isCorrect: normalizeAnswer(typingAnswer) === normalizeAnswer(expected),
      },
    ];
  });

  const correctCount = logs.filter((log) => log.isCorrect).length;
  const accuracy = Math.round((correctCount / logs.length) * 100);
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
