import { AssignmentStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Plus,
  School,
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { assignTemplateToClassesAction } from "../actions";
import { SyncAiPanel } from "../sync-ai-panel";

type AssignmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    assigned?: string;
    duplicates?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: AssignmentDetailPageProps) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const { id } = await params;
  const query = await searchParams;
  const template = await prisma.assignmentTemplate.findFirst({
    where: {
      id,
      teacherId: teacher.id,
    },
    include: {
      sourceDeck: {
        select: {
          id: true,
          title: true,
        },
      },
      lessons: {
        orderBy: { sortOrder: "asc" },
        include: {
          words: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              term: true,
              translation: true,
            },
          },
        },
      },
      classAssignments: {
        where: {
          status: { not: AssignmentStatus.ARCHIVED },
        },
        orderBy: { assignedAt: "desc" },
        include: {
          classRoom: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: { lessons: true },
          },
        },
      },
    },
  });

  if (!template) {
    notFound();
  }

  const classes = await prisma.classRoom.findMany({
    where: {
      teacherId: teacher.id,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      _count: {
        select: { members: true },
      },
    },
  });
  const studentProgressCount = await prisma.studentLessonProgress.count({
    where: {
      classLesson: {
        assignment: {
          templateId: template.id,
          teacherId: teacher.id,
        },
      },
    },
  });
  const assignedClassIds = new Set(
    template.classAssignments.map((assignment) => assignment.classId),
  );
  const totalWords = template.lessons.reduce(
    (sum, lesson) => sum + lesson.words.length,
    0,
  );
  const assignResult =
    query?.assigned || query?.duplicates
      ? {
          assigned: Number(query.assigned ?? 0),
          duplicates: Number(query.duplicates ?? 0),
        }
      : null;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Assignment template"
        title={template.title}
        description={template.description || "Lesson-based snapshot template created from a vocabulary deck."}
        action={
          <Button asChild variant="outline">
            <Link href="/teacher/assignments">
              <ArrowLeft />
              Back to assignments
            </Link>
          </Button>
        }
      />

      {query?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {query.error}
        </div>
      ) : null}

      {assignResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Assigned: {assignResult.assigned} · Duplicates skipped:{" "}
          {assignResult.duplicates}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Source deck" value={template.sourceDeck?.title ?? "Deck removed"} />
        <Metric label="Total words" value={totalWords.toString()} />
        <Metric label="Lessons" value={template.lessons.length.toString()} />
        <Metric label="Per lesson" value={template.wordsPerLesson.toString()} />
        <Metric label="Created" value={formatDate(template.createdAt)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
              <Layers3 className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Lessons</h2>
              <p className="text-sm text-slate-600">
                Template words are snapshots from the selected deck.
              </p>
            </div>
          </div>

          {template.lessons.map((lesson) => (
            <article
              key={lesson.id}
              className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                    Lesson {lesson.sortOrder + 1}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">
                    {lesson.title}
                  </h3>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {lesson.words.length} words
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {lesson.words.slice(0, 8).map((word) => (
                  <span
                    key={word.id}
                    className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100"
                  >
                    {word.term} · {word.translation}
                  </span>
                ))}
                {lesson.words.length > 8 ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    +{lesson.words.length - 8} more
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <SyncAiPanel
            templateId={template.id}
            hasSourceDeck={Boolean(template.sourceDeck?.id)}
            hasStudentProgress={studentProgressCount > 0}
          />

          <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-200/70">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
                <School className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Assign to class
                </h2>
                <p className="text-sm text-slate-600">
                  Create immutable class snapshots.
                </p>
              </div>
            </div>

            {classes.length === 0 ? (
              <EmptyState
                title="No classes yet"
                description="Create a class before assigning this template."
                action={
                  <Button asChild>
                    <Link href="/teacher/classes">Create class</Link>
                  </Button>
                }
              />
            ) : (
              <form
                action={assignTemplateToClassesAction.bind(null, template.id)}
                className="space-y-3"
              >
                {classes.map((classRoom) => {
                  const alreadyAssigned = assignedClassIds.has(classRoom.id);

                  return (
                    <label
                      key={classRoom.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm transition has-[:checked]:border-indigo-200 has-[:checked]:bg-indigo-50"
                    >
                      <input
                        type="checkbox"
                        name="classIds"
                        value={classRoom.id}
                        disabled={alreadyAssigned}
                        className="size-4 accent-indigo-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-slate-950">
                          {classRoom.title}
                        </span>
                        <span className="block text-xs font-medium text-slate-500">
                          {classRoom._count.members} students
                        </span>
                      </span>
                      {alreadyAssigned ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                          Assigned
                        </span>
                      ) : null}
                    </label>
                  );
                })}
                <Button type="submit" className="w-full">
                  <Plus />
                  Assign selected
                </Button>
              </form>
            )}
          </div>

          <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-200/70">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 ring-1 ring-blue-100">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Assigned classes
                </h2>
                <p className="text-sm text-slate-600">
                  Active class assignments for this template.
                </p>
              </div>
            </div>

            {template.classAssignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-600">
                No classes assigned yet.
              </div>
            ) : (
              <div className="space-y-2">
                {template.classAssignments.map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/teacher/classes/${assignment.classId}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <span>
                      <span className="block text-sm font-bold text-slate-950">
                        {assignment.classRoom.title}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {assignment._count.lessons} lessons ·{" "}
                        {formatDate(assignment.assignedAt)}
                      </span>
                    </span>
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}
