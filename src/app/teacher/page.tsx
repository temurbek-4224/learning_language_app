import { UserRole } from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const cards = [
  { label: "My classes", key: "classes" },
  { label: "My decks", key: "decks" },
  { label: "My assignments", key: "assignments" },
  { label: "Students in my classes", key: "students" },
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
      <h1 className="text-2xl font-semibold">Teacher dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-lg border border-zinc-200 bg-white p-5"
          >
            <p className="text-sm text-zinc-600">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{values[card.key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
