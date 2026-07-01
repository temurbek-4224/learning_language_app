import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";

import { createDeckAction } from "../actions";

type NewDeckPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewDeckPage({ searchParams }: NewDeckPageProps) {
  await requireRole(UserRole.TEACHER, "/teacher/login");
  const params = await searchParams;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="New vocabulary deck"
        title="Create deck"
        description="Start a reusable vocabulary set for future lessons and assignments."
        action={
          <Button asChild variant="outline">
            <Link href="/teacher/decks">
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

      <form
        action={createDeckAction}
        className="space-y-5 rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-200/70"
      >
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">Title</span>
          <input
            name="title"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">Description</span>
          <textarea
            name="description"
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
          />
        </label>
        <Button type="submit" size="lg">
          Create deck
        </Button>
      </form>
    </section>
  );
}
