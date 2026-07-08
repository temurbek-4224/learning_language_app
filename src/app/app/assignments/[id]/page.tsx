import { notFound } from "next/navigation";

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
            take: 1,
          },
        },
      },
    },
  });

  if (!assignment) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-xl shadow-indigo-200">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">
          Assignment
        </p>
        <h1 className="mt-2 text-2xl font-black">{assignment.title}</h1>
        <p className="mt-2 text-sm text-indigo-50">{assignment.classRoom.title}</p>
      </div>

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
            if (log.classLessonWordId) {
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
