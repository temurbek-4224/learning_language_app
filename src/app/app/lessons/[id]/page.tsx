import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";

import { getCurrentStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { AuthPending } from "../../auth-pending";

type LessonPlaceholderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LessonPlaceholderPage({
  params,
}: LessonPlaceholderPageProps) {
  const student = await getCurrentStudent();
  const { id } = await params;

  if (!student) {
    return <AuthPending />;
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
      words: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          term: true,
          translation: true,
        },
      },
    },
  });

  if (!lesson) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white shadow-xl shadow-indigo-200">
        <BookOpen className="size-7" />
        <h1 className="mt-3 text-2xl font-black">{lesson.title}</h1>
        <p className="mt-2 text-sm text-indigo-50">{lesson.words.length} words</p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Bu lessonni bajarish keyingi sprintda qo'shiladi.
      </div>

      <div className="space-y-2">
        {lesson.words.slice(0, 12).map((word) => (
          <div
            key={word.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200"
          >
            <span className="font-bold text-slate-950">{word.term}</span>
            <span className="text-sm font-semibold text-slate-600">
              {word.translation}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
