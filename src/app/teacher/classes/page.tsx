import { UserRole } from "@prisma/client";
import { Link2, Plus, School } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createClassAction } from "./actions";

type TeacherClassesPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getInviteLink(inviteCode: string) {
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim();

  if (!username) {
    return null;
  }

  return `https://t.me/${username}?start=class_${inviteCode}`;
}

export default async function TeacherClassesPage({
  searchParams,
}: TeacherClassesPageProps) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const params = await searchParams;
  const classes = await prisma.classRoom.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      inviteCode: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: { members: true },
      },
    },
  });

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Classroom setup"
        title="Classes"
        description="Create a class, get a Telegram invite link, and keep student access organized by teacher."
      />

      {params?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {params.error}
        </div>
      ) : null}

      {!process.env.TELEGRAM_BOT_USERNAME ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          TELEGRAM_BOT_USERNAME is missing. Invite links will show as placeholders.
        </div>
      ) : null}

      <form
        action={createClassAction}
        className="grid gap-4 rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-200/70 md:grid-cols-[1fr_1fr_auto]"
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
          <input
            name="description"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" size="lg">
            <Plus />
            Create Class
          </Button>
        </div>
      </form>

      {classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Create your first class to generate an invite link students can use from Telegram later."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((classRoom) => {
            const inviteLink = getInviteLink(classRoom.inviteCode);
            const displayLink =
              inviteLink ?? `t.me/<bot>?start=class_${classRoom.inviteCode}`;

            return (
              <article
                key={classRoom.id}
                className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
                      <School className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        {classRoom.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {classRoom.description || "No description added"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                    {classRoom.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Students
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">
                      {classRoom._count.members}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Created
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatDate(classRoom.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                    <Link2 className="size-4" />
                    Invite link
                  </div>
                  <p className="break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-indigo-100">
                    {displayLink}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
