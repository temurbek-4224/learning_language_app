import { UserRole } from "@prisma/client";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function TeacherDecksPage() {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const decks = await prisma.deck.findMany({
    where: { teacherId: teacher.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { words: true },
      },
    },
  });

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Vocabulary library"
        title="Decks"
        description="Create teacher-owned vocabulary decks and manage words before assignment workflows arrive."
        action={
          <Button asChild size="lg">
            <Link href="/teacher/decks/new">
              <Plus />
              Create deck
            </Link>
          </Button>
        }
      />
      {decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          description="Create your first deck, then add words manually or paste a simple word list."
          action={
            <Button asChild>
              <Link href="/teacher/decks/new">Create deck</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/teacher/decks/${deck.id}`}
              className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
                  <BookOpen className="size-5" />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {deck._count.words} words
                </span>
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-950 group-hover:text-indigo-700">
                {deck.title}
              </h2>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
                {deck.description || "No description added"}
              </p>
              <div className="mt-5 grid gap-2 text-xs font-medium text-slate-500">
                <div>Created: {formatDate(deck.createdAt)}</div>
                <div>Updated: {formatDate(deck.updatedAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
