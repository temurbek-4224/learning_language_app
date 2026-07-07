import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Lock } from "lucide-react";

import { getCurrentStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { AuthPending } from "../../auth-pending";

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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        Lesson player Sprint 6'da qo'shiladi.
      </div>

      <div className="space-y-3">
        {assignment.lessons.map((lesson, index) => {
          const open = index === 0;

          return (
            <Link
              key={lesson.id}
              href={open ? `/app/lessons/${lesson.id}` : "#"}
              className={`flex items-center justify-between gap-3 rounded-3xl border p-4 shadow-sm ${
                open
                  ? "border-indigo-200 bg-white shadow-indigo-100"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <span className="flex min-w-0 gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  {open ? <BookOpen className="size-5" /> : <Lock className="size-5" />}
                </span>
                <span>
                  <span className="block font-bold">{lesson.title}</span>
                  <span className="mt-1 block text-sm">
                    {lesson._count.words} words -{" "}
                    {open ? "Lesson 1 open" : "Locked"}
                  </span>
                </span>
              </span>
              <button
                type="button"
                disabled
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500"
              >
                Start
              </button>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
