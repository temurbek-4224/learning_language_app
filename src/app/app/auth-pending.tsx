export function AuthPending() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="rounded-3xl border border-indigo-100 bg-white p-6 text-center shadow-xl shadow-indigo-100">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
          WordXotira
        </p>
        <h1 className="mt-2 text-xl font-black text-slate-950">
          Telegram sessiya ochilmoqda
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Agar sahifa yangilanmasa, Mini Appni Telegram ichidan qayta oching.
        </p>
      </div>
    </section>
  );
}
