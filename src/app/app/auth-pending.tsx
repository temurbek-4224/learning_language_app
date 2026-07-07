"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type SessionStatus = "loading" | "error";

export function AuthPending() {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let resolved = false;

    function onSessionEvent(event: Event) {
      const detail = (event as CustomEvent).detail as
        | { status?: string; message?: string }
        | undefined;

      if (detail?.status === "authenticated") {
        resolved = true;
        return;
      }

      if (detail?.status === "error") {
        resolved = true;
        setStatus("error");
        setMessage(
          detail.message || "Mini App faqat Telegram ichida ochilganda ishlaydi.",
        );
      }
    }

    const timeoutId = window.setTimeout(() => {
      if (resolved) {
        return;
      }

      setStatus("error");
      setMessage("Mini App faqat Telegram ichida ochilganda ishlaydi.");
    }, 5000);

    window.addEventListener("wordxotira:telegram-session", onSessionEvent);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("wordxotira:telegram-session", onSessionEvent);
    };
  }, []);

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="rounded-3xl border border-indigo-100 bg-white p-6 text-center shadow-xl shadow-indigo-100">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
          WordXotira
        </p>
        <h1 className="mt-2 text-xl font-black text-slate-950">
          {status === "loading"
            ? "Telegram sessiya ochilmoqda"
            : "Telegram sessiya ochilmadi"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {status === "loading"
            ? "Agar sahifa yangilanmasa, Mini Appni Telegram ichidan qayta oching."
            : message || "Mini App faqat Telegram ichida ochilganda ishlaydi."}
        </p>
        {status === "error" ? (
          <Button
            type="button"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            <RefreshCw />
            Qayta urinish
          </Button>
        ) : null}
      </div>
    </section>
  );
}
