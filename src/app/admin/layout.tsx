import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/teachers", label: "Teachers" },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-lg font-semibold">
            WordXotira Admin
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-slate-950">
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
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
