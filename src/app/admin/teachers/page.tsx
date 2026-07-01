import Link from "next/link";
import { UserRole } from "@prisma/client";

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Teachers</h1>
          <p className="text-sm text-slate-600">
            Create teachers and reset temporary passwords.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/teachers/new">Create Teacher</Link>
        </Button>
      </div>

      {params?.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </div>
      ) : null}
      {params?.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {params.success}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Full name</th>
              <th className="px-4 py-3 font-medium">Login</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Classes</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Reset password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td className="px-4 py-3 font-medium">{teacher.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{teacher.login}</td>
                <td className="px-4 py-3">{teacher.status}</td>
                <td className="px-4 py-3">{teacher._count.classes}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(teacher.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <form
                    action={resetTeacherPasswordAction}
                    className="flex gap-2"
                  >
                    <input type="hidden" name="teacherId" value={teacher.id} />
                    <input
                      name="password"
                      type="password"
                      placeholder="New temp password"
                      className="h-9 w-44 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                      required
                    />
                    <Button type="submit" variant="outline" size="sm">
                      Save
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                  No teachers yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
