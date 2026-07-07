import { AssignmentStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Link2, School } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { InviteLinkControls } from "../invite-link-controls";

type ClassDetailPageProps = {
  params: Promise<{
    id: string;
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

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const { id } = await params;
  const classRoom = await prisma.classRoom.findFirst({
    where: {
      id,
      teacherId: teacher.id,
    },
    include: {
      _count: {
        select: { members: true },
      },
      assignments: {
        where: {
          status: { not: AssignmentStatus.ARCHIVED },
        },
        orderBy: { assignedAt: "desc" },
        include: {
          template: {
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

  if (!classRoom) {
    notFound();
  }

  const inviteLink = getInviteLink(classRoom.inviteCode);
  const startCommand = `/start class_${classRoom.inviteCode}`;
  const displayLink =
    inviteLink ??
    `https://t.me/<TELEGRAM_BOT_USERNAME>?start=class_${classRoom.inviteCode}`;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Class detail"
        title={classRoom.title}
        description={classRoom.description || "Teacher-owned class and assigned lesson snapshots."}
        action={
          <Button asChild variant="outline">
            <Link href="/teacher/classes">
              <ArrowLeft />
              Back to classes
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Students" value={classRoom._count.members.toString()} />
        <Metric label="Assignments" value={classRoom.assignments.length.toString()} />
        <Metric label="Created" value={formatDate(classRoom.createdAt)} />
      </div>

      {!process.env.TELEGRAM_BOT_USERNAME ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          TELEGRAM_BOT_USERNAME env topilmadi.
        </div>
      ) : null}

      <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-sm shadow-indigo-100">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
          <Link2 className="size-4" />
          Telegram invite link
        </div>
        <p className="break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-indigo-100">
          {displayLink}
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
          Real Telegram bot production database bilan ishlaydi. Localhostdagi
          class link production botda ishlamasligi mumkin.
        </p>
        <InviteLinkControls
          inviteLink={inviteLink}
          startCommand={startCommand}
        />
      </div>

      <div className="rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-200/70">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Class assignments
            </h2>
            <p className="text-sm text-slate-600">
              Progress will appear after student app.
            </p>
          </div>
        </div>

        {classRoom.assignments.length === 0 ? (
          <EmptyState
            title="No assignments yet"
            description="Assign an assignment template to this class from the assignment detail page."
            action={
              <Button asChild>
                <Link href="/teacher/assignments">Open assignments</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {classRoom.assignments.map((assignment) => (
              <article
                key={assignment.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/60"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-3">
                    <div className="rounded-2xl bg-white p-3 text-indigo-600 ring-1 ring-indigo-100">
                      <School className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-950">
                        {assignment.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Template: {assignment.template.title}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        Progress will appear after student app
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                      {assignment._count.lessons} lessons
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                      {assignment.status}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                      {formatDate(assignment.createdAt)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
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
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
