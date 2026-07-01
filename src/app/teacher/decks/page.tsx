import { UserRole } from "@prisma/client";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireRole } from "@/lib/auth";

export default async function TeacherDecksPage() {
  await requireRole(UserRole.TEACHER, "/teacher/login");

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Coming next"
        title="Decks"
        description="Vocabulary deck creation is reserved for Sprint 3. This page is intentionally kept as a clean placeholder."
      />
      <EmptyState
        title="Deck builder is coming soon"
        description="Teachers will create word decks here before turning them into lesson assignments."
        action={
          <div className="rounded-2xl bg-white p-3 text-indigo-600 shadow-sm ring-1 ring-indigo-100">
            <BookOpen className="size-5" />
          </div>
        }
      />
    </section>
  );
}
