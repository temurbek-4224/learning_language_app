import { UserRole } from "@prisma/client";
import { BookOpen, ClipboardList, School, Users } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const cards = [
  {
    label: "My classes",
    key: "classes",
    icon: School,
    description: "Active class spaces",
  },
  {
    label: "My decks",
    key: "decks",
    icon: BookOpen,
    description: "Coming in Sprint 3",
  },
  {
    label: "My assignments",
    key: "assignments",
    icon: ClipboardList,
    description: "Coming in Sprint 3",
  },
  {
    label: "Total students",
    key: "students",
    icon: Users,
    description: "Joined in your classes",
  },
] as const;

export default async function TeacherPage() {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");

  const [classes, students] = await Promise.all([
    prisma.classRoom.count({ where: { teacherId: teacher.id } }),
    prisma.classMember.count({
      where: {
        classRoom: {
          teacherId: teacher.id,
        },
      },
    }),
  ]);

  const values = {
    classes,
    decks: "Later",
    assignments: "Later",
    students,
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Teacher workspace"
        title={`Welcome, ${teacher.fullName}`}
        description="Create classes, share invite links, and prepare for vocabulary assignments in the next sprint."
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
        <h2 className="text-lg font-bold text-slate-950">Next best action</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Start by creating a class and sharing its Telegram invite link with
          students. Decks and assignments stay as clean placeholders for Sprint 3.
        </p>
      </div>
    </section>
  );
}
