import { UserRole } from "@prisma/client";
import Link from "next/link";
import { ClipboardList, Layers3, Plus } from "lucide-react";

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

export default async function TeacherAssignmentsPage() {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const templates = await prisma.assignmentTemplate.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    include: {
      sourceDeck: {
        select: {
          title: true,
        },
      },
      lessons: {
        select: {
          _count: {
            select: { words: true },
          },
        },
      },
      classAssignments: {
        where: {
          status: { not: "ARCHIVED" },
        },
        select: {
          classId: true,
        },
      },
    },
  });

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Lesson templates"
        title="Assignments"
        description="Convert vocabulary decks into lesson-based assignment templates and assign snapshots to classes."
        action={
          <Button asChild size="lg">
            <Link href="/teacher/assignments/new">
              <Plus />
              Create assignment
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Create an assignment from a deck to split words into lessons before assigning them to classes."
          action={
            <Button asChild>
              <Link href="/teacher/assignments/new">Create assignment</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => {
            const totalWords = template.lessons.reduce(
              (sum, lesson) => sum + lesson._count.words,
              0,
            );

            return (
              <Link
                key={template.id}
                href={`/teacher/assignments/${template.id}`}
                className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
                      <ClipboardList className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950 group-hover:text-indigo-700">
                        {template.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Source deck: {template.sourceDeck?.title ?? "Deck removed"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
                    {template.status}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Words" value={totalWords.toString()} />
                  <Metric label="Lessons" value={template.lessons.length.toString()} />
                  <Metric
                    label="Per lesson"
                    value={template.wordsPerLesson.toString()}
                  />
                  <Metric
                    label="Classes"
                    value={template.classAssignments.length.toString()}
                  />
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Layers3 className="size-4 text-indigo-500" />
                  Created {formatDate(template.createdAt)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
