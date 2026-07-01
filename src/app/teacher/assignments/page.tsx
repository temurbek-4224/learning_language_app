import { UserRole } from "@prisma/client";
import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireRole } from "@/lib/auth";

export default async function TeacherAssignmentsPage() {
  await requireRole(UserRole.TEACHER, "/teacher/login");

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Coming next"
        title="Assignments"
        description="Assignment templates and class snapshots are not part of Sprint 2.5, but the route is ready."
      />
      <EmptyState
        title="Assignments are coming soon"
        description="After decks are ready, teachers will assign structured lesson flows to their classes from here."
        action={
          <div className="rounded-2xl bg-white p-3 text-indigo-600 shadow-sm ring-1 ring-indigo-100">
            <ClipboardList className="size-5" />
          </div>
        }
      />
    </section>
  );
}
