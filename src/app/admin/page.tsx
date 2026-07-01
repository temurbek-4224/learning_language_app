import { UserRole, UserStatus } from "@prisma/client";
import { GraduationCap, School, Users, UserCheck } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const cards = [
  {
    label: "Total teachers",
    key: "totalTeachers",
    icon: GraduationCap,
    description: "Teacher accounts created",
  },
  {
    label: "Active teachers",
    key: "activeTeachers",
    icon: UserCheck,
    description: "Ready to access dashboard",
  },
  {
    label: "Total classes",
    key: "totalClasses",
    icon: School,
    description: "Classes across all teachers",
  },
  {
    label: "Total students",
    key: "totalStudents",
    icon: Users,
    description: "Students joined through Telegram",
  },
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
      <PageHeader
        eyebrow="Platform overview"
        title="Admin dashboard"
        description="Monitor the core WordXotira school network and manage teacher access from one clean workspace."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <DashboardCard
            key={card.key}
            label={card.label}
            value={values[card.key]}
            description={card.description}
            icon={card.icon}
          />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/70">
        <h2 className="text-lg font-bold text-slate-950">Sprint focus</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Admin tools are focused on teacher account control for this MVP:
          create teachers, keep access active, and prepare classes for the
          Telegram student flow in the next sprint.
        </p>
      </div>
    </section>
  );
}
