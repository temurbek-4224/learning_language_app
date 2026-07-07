import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, Layers3 } from "lucide-react";

import { getCurrentStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { AuthPending } from "./auth-pending";

export default async function StudentMiniAppPage() {
  const student = await getCurrentStudent();

  if (!student) {
    return <AuthPending />;
  }

  const memberships = await prisma.classMember.findMany({
    where: { studentId: student.id },
    include: {
      classRoom: {
        include: {
          assignments: {
            where: { status: { not: "ARCHIVED" } },
            include: {
              lessons: {
                include: {
                  _count: { select: { words: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const activeAssignments = memberships.reduce(
    (sum, membership) => sum + membership.classRoom.assignments.length,
    0,
  );
  const openLessons = memberships.reduce(
    (sum, membership) =>
      sum +
      membership.classRoom.assignments.reduce(
        (assignmentSum, assignment) => assignmentSum + assignment.lessons.length,
        0,
      ),
    0,
  );

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 p-5 text-white shadow-xl shadow-indigo-200">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">
          WordXotira
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          Salom, {student.firstName || "student"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-indigo-50">
          Ustozingiz bergan darslar va assignmentlar shu yerda ko'rinadi.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric icon={<GraduationCap />} label="Classes" value={memberships.length} />
        <Metric icon={<Layers3 />} label="Assignments" value={activeAssignments} />
        <Metric icon={<BookOpen />} label="Open lessons" value={openLessons} />
        <Metric icon={<BookOpen />} label="Completed" value={0} />
      </div>

      <Link
        href="/app/classes"
        className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200"
      >
        <span>
          <span className="block font-bold text-slate-950">Classes</span>
          <span className="text-sm text-slate-600">Joined classlarni ko'rish</span>
        </span>
        <ArrowRight className="size-5 text-indigo-600" />
      </Link>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200">
      <div className="mb-3 flex size-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}
