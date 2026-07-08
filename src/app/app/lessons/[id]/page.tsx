import Link from "next/link";
import { BookOpen, CheckCircle2, Lock, ShieldAlert } from "lucide-react";

import { getCurrentStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { AuthPending } from "../../auth-pending";
import { LessonPlayer } from "./lesson-player";

type LessonPlaceholderPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function StudentLessonPage({
  params,
  searchParams,
}: LessonPlaceholderPageProps) {
  const student = await getCurrentStudent();
  const { id } = await params;
  const { mode } = await searchParams;
  const failedOnly = mode === "failed";

  if (!student) {
    return <AuthPending />;
  }

  const existingLesson = await prisma.classLesson.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingLesson) {
    return <FriendlyMessage icon={<BookOpen />} text="Lesson topilmadi." />;
  }

  const lesson = await prisma.classLesson.findFirst({
    where: {
      id,
      assignment: {
        classRoom: {
          members: {
            some: { studentId: student.id },
          },
        },
      },
    },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          classRoom: { select: { title: true } },
        },
      },
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
    return (
      <FriendlyMessage
        icon={<ShieldAlert />}
        text="Bu lesson sizga tegishli emas."
      />
    );
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
      return (
        <FriendlyMessage
          icon={<Lock />}
          text="Avval oldingi lessonni yakunlang."
          href={`/app/assignments/${lesson.assignment.id}`}
        />
      );
    }
  }

  if (lesson.words.length === 0) {
    return <FriendlyMessage icon={<BookOpen />} text="Bu lessonda hali so'zlar yo'q." />;
  }

  let playerWords = lesson.words;

  if (failedOnly) {
    const progress = await prisma.studentLessonProgress.findUnique({
      where: {
        studentId_classLessonId: {
          studentId: student.id,
          classLessonId: lesson.id,
        },
      },
      select: {
        status: true,
        answerLogs: {
          where: {
            activity: {
              in: ["TRANSLATION_QUIZ", "DEFINITION_TYPING", "EXAMPLE"],
            },
          },
          orderBy: { answeredAt: "asc" },
          select: {
            activity: true,
            classLessonWordId: true,
            isCorrect: true,
          },
        },
      },
    });

    if (!progress || progress.status !== "COMPLETED") {
      return (
        <FriendlyMessage
          icon={<Lock />}
          text="Faqat yakunlangan lessonni qayta ishlash mumkin."
          href={`/app/assignments/${lesson.assignment.id}`}
        />
      );
    }

    const latestByStepWord = new Map<
      string,
      { classLessonWordId: string | null; isCorrect: boolean }
    >();

    for (const log of progress.answerLogs) {
      if (log.classLessonWordId) {
        latestByStepWord.set(`${log.activity}:${log.classLessonWordId}`, log);
      }
    }

    const failedWordIds = new Set<string>();

    for (const log of latestByStepWord.values()) {
      if (log.classLessonWordId && !log.isCorrect) {
        failedWordIds.add(log.classLessonWordId);
      }
    }

    if (failedWordIds.size === 0) {
      return (
        <FriendlyMessage
          icon={<CheckCircle2 />}
          text="Sizda xato so'zlar yo'q."
          href={`/app/assignments/${lesson.assignment.id}`}
        />
      );
    }

    playerWords = lesson.words.filter((word) => failedWordIds.has(word.id));
  }

  return (
    <LessonPlayer
      lessonId={lesson.id}
      assignmentId={lesson.assignment.id}
      title={lesson.title}
      classTitle={lesson.assignment.classRoom.title}
      words={playerWords}
    />
  );
}

function FriendlyMessage({
  icon,
  text,
  href = "/app",
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white shadow-xl shadow-indigo-200">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
          {icon}
        </div>
        <h1 className="mt-4 text-2xl font-black">Lesson</h1>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-200">
        <p className="text-sm font-bold leading-6 text-slate-700">{text}</p>
        <Link
          href={href}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 text-sm font-bold text-white shadow-sm"
        >
          Orqaga
        </Link>
      </div>
    </section>
  );
}
