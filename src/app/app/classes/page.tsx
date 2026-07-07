import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import { getCurrentStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { AuthPending } from "../auth-pending";

export default async function StudentClassesPage() {
  const student = await getCurrentStudent();

  if (!student) {
    return <AuthPending />;
  }

  const memberships = await prisma.classMember.findMany({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    include: {
      classRoom: {
        include: {
          teacher: { select: { fullName: true } },
          _count: { select: { assignments: true } },
        },
      },
    },
  });

  return (
    <section className="space-y-4">
      <Header title="Classes" description="Siz qo'shilgan teacher classlar." />

      {memberships.length === 0 ? (
        <EmptyMessage text="Hali classga qo'shilmagansiz. Ustozingiz yuborgan link orqali qo'shiling." />
      ) : (
        <div className="space-y-3">
          {memberships.map((membership) => (
            <Link
              key={membership.id}
              href={`/app/classes/${membership.classId}`}
              className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200"
            >
              <span className="flex min-w-0 gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <GraduationCap className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-slate-950">
                    {membership.classRoom.title}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {membership.classRoom.teacher.fullName}
                  </span>
                  <span className="mt-2 block text-xs font-semibold text-slate-500">
                    {membership.classRoom._count.assignments} assignments - Progress later
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

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
        WordXotira
      </p>
      <h1 className="mt-1 text-2xl font-black text-slate-950">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/70 p-6 text-center text-sm font-semibold leading-6 text-slate-700">
      {text}
    </div>
  );
}
