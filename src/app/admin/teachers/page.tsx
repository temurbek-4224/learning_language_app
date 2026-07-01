import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Plus, ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { resetTeacherPasswordAction } from "./actions";

type AdminTeachersPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function AdminTeachersPage({
  searchParams,
}: AdminTeachersPageProps) {
  await requireRole(UserRole.SUPER_ADMIN, "/admin/login");

  const params = await searchParams;
  const teachers = await prisma.webUser.findMany({
    where: { role: UserRole.TEACHER },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      login: true,
      status: true,
      createdAt: true,
      _count: {
        select: { classes: true },
      },
    },
  });

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="Teachers"
        description="Create teacher accounts, review their class ownership, and reset temporary passwords without exposing credentials."
        action={
          <Button asChild size="lg">
            <Link href="/admin/teachers/new">
              <Plus />
              Create Teacher
            </Link>
          </Button>
        }
      />

      {params?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {params.error}
        </div>
      ) : null}
      {params?.success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {params.success}
        </div>
      ) : null}

      {teachers.length === 0 ? (
        <EmptyState
          title="No teachers yet"
          description="Create the first teacher account so they can start building classes."
          action={
            <Button asChild>
              <Link href="/admin/teachers/new">Create Teacher</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="rounded-2xl bg-indigo-50 p-2 text-indigo-600">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">Teacher accounts</h2>
              <p className="text-sm text-slate-500">
                {teachers.length} account{teachers.length === 1 ? "" : "s"} found
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Full name</th>
                  <th className="px-5 py-3 font-bold">Login</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Classes</th>
                  <th className="px-5 py-3 font-bold">Created</th>
                  <th className="px-5 py-3 font-bold">Reset password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-indigo-50/30">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-950">
                        {teacher.fullName}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{teacher.login}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={teacher.status} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {teacher._count.classes}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(teacher.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <form
                        action={resetTeacherPasswordAction}
                        className="flex gap-2"
                      >
                        <input type="hidden" name="teacherId" value={teacher.id} />
                        <input
                          name="password"
                          type="password"
                          placeholder="New temp password"
                          className="h-10 w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
                          required
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Save
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
