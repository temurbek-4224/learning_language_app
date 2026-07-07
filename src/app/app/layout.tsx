import Link from "next/link";
import Script from "next/script";
import { BookOpen, GraduationCap, Home } from "lucide-react";

import { TelegramSessionInit } from "./telegram-session-init";

export default function StudentMiniAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef2ff_0%,#f8fafc_38%,#ffffff_100%)] text-slate-950">
      <Script src="https://telegram.org/js/telegram-web-app.js" />
      <TelegramSessionInit />
      <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-5">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-white/90 px-4 py-3 shadow-2xl shadow-slate-300/50 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2 text-xs font-bold text-slate-600">
          <NavItem href="/app" label="Home" icon={<Home className="size-4" />} />
          <NavItem
            href="/app/classes"
            label="Classes"
            icon={<GraduationCap className="size-4" />}
          />
          <NavItem
            href="/app"
            label="Lessons"
            icon={<BookOpen className="size-4" />}
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700"
    >
      {icon}
      {label}
    </Link>
  );
}
