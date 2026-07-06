import { UserRole } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createAssignmentTemplateAction } from "../actions";

type NewAssignmentPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewAssignmentPage({
  searchParams,
}: NewAssignmentPageProps) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const params = await searchParams;
  const decks = await prisma.deck.findMany({
    where: { teacherId: teacher.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      _count: {
        select: { words: true },
      },
    },
  });
  const usableDecks = decks.filter((deck) => deck._count.words > 0);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="New assignment"
        title="Create assignment"
        description="Choose a deck, set lesson size, and WordXotira will snapshot words into reusable lessons."
        action={
          <Button asChild variant="outline">
            <Link href="/teacher/assignments">
              <ArrowLeft />
              Back
            </Link>
          </Button>
        }
      />

      {params?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {params.error}
        </div>
      ) : null}

      {decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          description="Create a deck and add words before creating an assignment template."
          action={
            <Button asChild>
              <Link href="/teacher/decks/new">Create deck</Link>
            </Button>
          }
        />
      ) : usableDecks.length === 0 ? (
        <EmptyState
          title="No decks with words"
          description="At least one word is required before a deck can become an assignment."
          action={
            <Button asChild>
              <Link href="/teacher/decks">Open decks</Link>
            </Button>
          }
        />
      ) : (
        <form
          action={createAssignmentTemplateAction}
          className="space-y-6 rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-200/70"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Assignment setup
              </h2>
              <p className="text-sm text-slate-600">
                Lesson chunks use the current deck word order.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Title</span>
              <input
                name="title"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">
                Words per lesson
              </span>
              <input
                name="wordsPerLesson"
                type="number"
                min={5}
                max={15}
                defaultValue={10}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
                required
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">
              Description
            </span>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">Deck</span>
            <select
              name="deckId"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
              required
            >
              <option value="">Select a deck</option>
              {usableDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title} ({deck._count.words} words)
                </option>
              ))}
            </select>
          </label>

          <Button type="submit" size="lg">
            Create assignment
          </Button>
        </form>
      )}
    </section>
  );
}
