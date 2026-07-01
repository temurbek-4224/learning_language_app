import { UserRole, UserStatus } from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const cards = [
  { label: "Total teachers", key: "totalTeachers" },
  { label: "Active teachers", key: "activeTeachers" },
  { label: "Total classes", key: "totalClasses" },
  { label: "Total students", key: "totalStudents" },
] as const;

export default async function AdminPage() {
  await requireRole(UserRole.SUPER_ADMIN, "/admin/login");

  const [totalTeachers, activeTeachers, totalClasses, totalStudents] =
    await Promise.all([
      prisma.webUser.count({ where: { role: UserRole.TEACHER } }),
      prisma.webUser.count({
        where: { role: UserRole.TEACHER, status: UserStatus.ACTIVE },
      }),
      prisma.classRoom.count(),
      prisma.student.count(),
    ]);

  const values = {
    totalTeachers,
    activeTeachers,
    totalClasses,
    totalStudents,
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <p className="text-sm text-slate-600">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{values[card.key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
