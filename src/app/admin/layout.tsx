import Link from "next/link";
import { UserRole } from "@prisma/client";

import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/teachers", label: "Teachers" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === UserRole.SUPER_ADMIN;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff,transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-sm font-black text-white shadow-lg shadow-indigo-200">
              WX
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight">
                WordXotira
              </span>
              <span className="block text-xs font-medium text-slate-500">
                Admin panel
              </span>
            </span>
          </Link>
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <nav className="hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm font-semibold text-slate-600 shadow-sm sm:flex">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Logout
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
