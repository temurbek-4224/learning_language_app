import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ArrowLeft, BookOpen, Upload } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import {
  createWordAction,
  deleteWordAction,
  importWordsAction,
  updateWordAction,
} from "../actions";
import { WordForm } from "../word-form";

type DeckDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    imported?: string;
    skipped?: string;
    duplicate?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function DeckDetailPage({
  params,
  searchParams,
}: DeckDetailPageProps) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const { id } = await params;
  const query = await searchParams;
  const deck = await prisma.deck.findFirst({
    where: {
      id,
      teacherId: teacher.id,
    },
    include: {
      words: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      _count: {
        select: { words: true },
      },
    },
  });

  if (!deck) {
    notFound();
  }

  const importResult =
    query?.imported || query?.skipped || query?.duplicate
      ? {
          imported: Number(query.imported ?? 0),
          skipped: Number(query.skipped ?? 0),
          duplicate: Number(query.duplicate ?? 0),
        }
      : null;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Deck detail"
        title={deck.title}
        description={deck.description || "Manage words in this teacher-owned deck."}
        action={
          <Button asChild variant="outline">
            <Link href="/teacher/decks">
              <ArrowLeft />
              Back to decks
            </Link>
          </Button>
        }
      />

      {query?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {query.error}
        </div>
      ) : null}

      {importResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Imported: {importResult.imported} · Skipped: {importResult.skipped} ·
          Duplicates: {importResult.duplicate}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Words count
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {deck._count.words}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 md:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Updated
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {formatDate(deck.updatedAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-200/70">
            <WordForm
              title="Add word"
              submitLabel="Add word"
              action={createWordAction.bind(null, deck.id)}
            />
          </div>

          <div className="rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-200/70">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
                <Upload className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Copy-paste import
                </h2>
                <p className="text-sm text-slate-600">
                  Example: worker - ishchi, bread: non, choice — tanlov
                </p>
              </div>
            </div>
            <form action={importWordsAction.bind(null, deck.id)} className="space-y-4">
              <textarea
                name="importText"
                rows={7}
                placeholder={"worker - ishchi\nbread - non\nchoice - tanlov\ndoctor - shifokor"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
                required
              />
              <Button type="submit" variant="secondary">
                Import words
              </Button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Words</h2>
              <p className="text-sm text-slate-600">
                Edit definitions and examples before using the deck later.
              </p>
            </div>
          </div>

          {deck.words.length === 0 ? (
            <EmptyState
              title="No words yet"
              description="Add a word manually or paste a list to build this deck."
            />
          ) : (
            deck.words.map((word) => (
              <article
                key={word.id}
                className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70"
              >
                <WordForm
                  title={word.term}
                  submitLabel="Save changes"
                  action={updateWordAction.bind(null, word.id)}
                  initialValues={{
                    english: word.term,
                    translation: word.translation,
                    definition: word.definition,
                    example: word.example,
                  }}
                />
                <form action={deleteWordAction.bind(null, word.id)} className="mt-4">
                  <Button type="submit" variant="danger" size="sm">
                    Delete word
                  </Button>
                </form>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
