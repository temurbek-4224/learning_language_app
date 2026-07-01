import { teacherLoginAction } from "./actions";

type TeacherLoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function TeacherLoginPage({
  searchParams,
}: TeacherLoginPageProps) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-120px)] max-w-md items-center">
      <div className="w-full overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-violet-100">
        <div className="h-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600" />
        <div className="space-y-6 p-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-lg font-black text-white shadow-lg shadow-violet-200">
              WX
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                WordXotira Teacher
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Sign in to create classes and share invite links.
              </p>
            </div>
          </div>
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}
      <form action={teacherLoginAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-700">Login</span>
          <input
            name="login"
            type="text"
            autoComplete="username"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
        <button className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:from-violet-500 hover:to-blue-500">
          Login
        </button>
      </form>
        </div>
      </div>
    </section>
  );
}
