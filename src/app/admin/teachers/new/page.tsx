import { UserRole } from "@prisma/client";

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
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Teacher</h1>
        <p className="text-sm text-slate-600">
          Create a teacher account with a temporary password.
        </p>
      </div>

      {params?.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {params.error}
        </div>
      ) : null}

      <form
        action={createTeacherAction}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium">Full name</span>
          <input
            name="fullName"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Login</span>
          <input
            name="login"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Temporary password</span>
          <input
            name="password"
            type="password"
            minLength={8}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Status</span>
          <select
            name="status"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            defaultValue="ACTIVE"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
        <Button type="submit">Create Teacher</Button>
      </form>
    </section>
  );
}
