import Link from "next/link";
import { BookOpen, Lock, ShieldAlert } from "lucide-react";

import { getCurrentStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { AuthPending } from "../../auth-pending";
import { LessonListClient } from "./lesson-list-client";

type StudentAssignmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentAssignmentDetailPage({
  params,
}: StudentAssignmentDetailPageProps) {
  const student = await getCurrentStudent();
  const { id } = await params;

  if (!student) {
    return <AuthPending />;
  }

  const existingAssignment = await prisma.classAssignment.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingAssignment) {
    return (
      <FriendlyMessage
        icon={<BookOpen />}
        title="Assignment topilmadi"
        text="Bu assignment mavjud emas yoki o'chirilgan."
      />
    );
  }

  const assignment = await prisma.classAssignment.findFirst({
    where: {
      id,
      classRoom: {
        members: {
          some: { studentId: student.id },
        },
      },
    },
    include: {
      classRoom: { select: { title: true } },
      lessons: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { words: true } },
          progress: {
            where: { studentId: student.id },
            select: {
              status: true,
              score: true,
              completedAt: true,
              answerLogs: {
                orderBy: { answeredAt: "asc" },
                select: {
                  activity: true,
                  classLessonWordId: true,
                  isCorrect: true,
                },
              },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!assignment) {
    return (
      <FriendlyMessage
        icon={<ShieldAlert />}
        title="Ruxsat yo'q"
        text="Bu assignment siz qo'shilgan classga tegishli emas."
      />
    );
  }

  if (assignment.lessons.length === 0) {
    return (
      <section className="space-y-4">
        <AssignmentHeader
          title={assignment.title}
          classTitle={assignment.classRoom.title}
        />
        <FriendlyMessage
          icon={<Lock />}
          title="Lessonlar yo'q"
          text="Bu assignment ichida hali lessonlar mavjud emas."
          compact
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <AssignmentHeader
        title={assignment.title}
        classTitle={assignment.classRoom.title}
      />

      <LessonListClient
        lessons={assignment.lessons.map((lesson, index) => {
          const completed = lesson.progress.some(
            (progress) => progress.status === "COMPLETED",
          );
          const previousCompleted =
            index === 0 ||
            assignment.lessons[index - 1].progress.some(
              (progress) => progress.status === "COMPLETED",
            );
          const open = completed || previousCompleted;
          const latestByStepWord = new Map<
            string,
            { classLessonWordId: string | null; isCorrect: boolean }
          >();

          for (const log of lesson.progress[0]?.answerLogs ?? []) {
            if (
              log.classLessonWordId &&
              ["TRANSLATION_QUIZ", "DEFINITION_TYPING", "EXAMPLE"].includes(
                log.activity,
              )
            ) {
              latestByStepWord.set(`${log.activity}:${log.classLessonWordId}`, log);
            }
          }

          return {
            id: lesson.id,
            title: lesson.title,
            wordsCount: lesson._count.words,
            completed,
            open,
            score: lesson.progress[0]?.score ?? null,
            hasFailedWords: Array.from(latestByStepWord.values()).some(
              (log) => !log.isCorrect,
            ),
          };
        })}
      />
    </section>
  );
}

function AssignmentHeader({
  title,
  classTitle,
}: {
  title: string;
  classTitle: string;
}) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-xl shadow-indigo-200">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">
        Assignment
      </p>
      <h1 className="mt-2 text-2xl font-black">{title}</h1>
      <p className="mt-2 text-sm text-indigo-50">{classTitle}</p>
    </div>
  );
}

function FriendlyMessage({
  icon,
  title,
  text,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "" : "space-y-4"}>
      {!compact ? (
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white shadow-xl shadow-indigo-200">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
            {icon}
          </div>
          <h1 className="mt-4 text-2xl font-black">Assignment</h1>
        </div>
      ) : null}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-200">
        {compact ? (
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            {icon}
          </div>
        ) : null}
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{text}</p>
        <Link
          href="/app/classes"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 text-sm font-bold text-white shadow-sm"
        >
          Classlarga qaytish
        </Link>
      </div>
    </section>
  );
}
