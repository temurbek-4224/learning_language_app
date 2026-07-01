import { UserRole } from "@prisma/client";

import { requireRole } from "@/lib/auth";

export default async function TeacherAssignmentsPage() {
  await requireRole(UserRole.TEACHER, "/teacher/login");

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Assignments</h1>
      <p className="text-zinc-600">
        Placeholder for assignment templates and class assignment snapshots.
      </p>
    </section>
  );
}
