import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList } from "lucide-react";

import { getCurrentStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { AuthPending } from "../../auth-pending";

type StudentClassDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentClassDetailPage({
  params,
}: StudentClassDetailPageProps) {
  const student = await getCurrentStudent();
  const { id } = await params;

  if (!student) {
    return <AuthPending />;
  }

  const membership = await prisma.classMember.findFirst({
    where: {
      studentId: student.id,
      classId: id,
    },
    include: {
      classRoom: {
        include: {
          teacher: { select: { fullName: true } },
          assignments: {
            where: { status: { not: "ARCHIVED" } },
            orderBy: { assignedAt: "desc" },
            include: {
              _count: { select: { lessons: true } },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white shadow-xl shadow-indigo-200">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">
          Class
        </p>
        <h1 className="mt-2 text-2xl font-black">{membership.classRoom.title}</h1>
        <p className="mt-2 text-sm text-indigo-50">
          Teacher: {membership.classRoom.teacher.fullName}
        </p>
      </div>

      {membership.classRoom.assignments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-600">
          Bu classda hali assignment yo'q.
        </div>
      ) : (
        <div className="space-y-3">
          {membership.classRoom.assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/app/assignments/${assignment.id}`}
              className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200"
            >
              <span className="flex min-w-0 gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <ClipboardList className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-slate-950">
                    {assignment.title}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {assignment._count.lessons} lessons - 0 completed
                  </span>
                  <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                    {assignment.status}
                  </span>
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-indigo-600" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
