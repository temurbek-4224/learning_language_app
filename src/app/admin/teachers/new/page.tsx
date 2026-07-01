import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";

import { createTeacherAction } from "../actions";

type NewTeacherPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewTeacherPage({
  searchParams,
}: NewTeacherPageProps) {
  await requireRole(UserRole.SUPER_ADMIN, "/admin/login");
  const params = await searchParams;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="New account"
        title="Create Teacher"
        description="Set up a teacher account with a temporary password. The password is hashed before it is stored."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/teachers">
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
        action={createTeacherAction}
        className="space-y-5 rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-200/70"
      >
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">Full name</span>
          <input
            name="fullName"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">Login</span>
          <input
            name="login"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">
            Temporary password
          </span>
          <input
            name="password"
            type="password"
            minLength={8}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">Status</span>
          <select
            name="status"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            defaultValue="ACTIVE"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
        <div className="pt-2">
          <Button type="submit" size="lg">
            Create Teacher
          </Button>
        </div>
      </form>
    </section>
  );
}
