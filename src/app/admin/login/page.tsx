import { adminLoginAction } from "./actions";

type AdminLoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <section className="mx-auto max-w-md space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Admin login</h1>
        <p className="text-sm text-slate-600">Sign in with your admin login.</p>
      </div>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <form action={adminLoginAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Login</span>
          <input
            name="login"
            type="text"
            autoComplete="username"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            required
          />
        </label>
        <button className="h-10 w-full rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
          Login
        </button>
      </form>
    </section>
  );
}
