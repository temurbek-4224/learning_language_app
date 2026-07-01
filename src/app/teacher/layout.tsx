import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/teacher", label: "Overview" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/decks", label: "Decks" },
  { href: "/teacher/assignments", label: "Assignments" },
];

export default function TeacherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/teacher" className="text-lg font-semibold">
            WordXotira Teacher
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-zinc-600">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-zinc-950">
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
