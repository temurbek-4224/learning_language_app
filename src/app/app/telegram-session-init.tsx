"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TelegramSessionStatus = "loading" | "authenticated" | "error";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: unknown;
        };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

function emitTelegramSessionStatus(status: TelegramSessionStatus, message = "") {
  window.dispatchEvent(
    new CustomEvent("wordxotira:telegram-session", {
      detail: { status, message },
    }),
  );
}

export function TelegramSessionInit() {
  const router = useRouter();
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    function isLocalHost() {
      return ["localhost", "127.0.0.1"].includes(window.location.hostname);
    }

    async function openSession(initData: string) {
      const response = await fetch("/api/app/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      if (!response.ok) {
        return false;
      }

      const session = (await response.json().catch(() => null)) as
        | { devMode?: boolean }
        | null;

      if (!cancelled) {
        setDevMode(Boolean(session?.devMode));
      }

      return true;
    }

    async function resolveSession() {
      if (cancelled) {
        return;
      }

      const webApp = window.Telegram?.WebApp;

      if (!webApp) {
        if (isLocalHost()) {
          try {
            const ok = await openSession("");

            if (!ok) {
              emitTelegramSessionStatus(
                "error",
                "Local dev sessiya ochilmadi. DEV_TELEGRAM_ID ni .env ichida tekshiring.",
              );
              return;
            }

            emitTelegramSessionStatus("authenticated");
            router.refresh();
          } catch {
            emitTelegramSessionStatus(
              "error",
              "Local dev sessiyani ochishda xatolik yuz berdi.",
            );
          }

          return;
        }

        if (Date.now() - startedAt >= 5000) {
          emitTelegramSessionStatus(
            "error",
            "Mini App faqat Telegram ichida ochilganda ishlaydi.",
          );
          return;
        }

        window.setTimeout(resolveSession, 150);
        return;
      }

      webApp.ready?.();
      webApp.expand?.();

      const initData = webApp.initData ?? "";
      const hasUnsafeUser = Boolean(webApp.initDataUnsafe?.user);

      if (!initData) {
        if (isLocalHost()) {
          try {
            const ok = await openSession("");

            if (!ok) {
              emitTelegramSessionStatus(
                "error",
                "Local dev sessiya ochilmadi. DEV_TELEGRAM_ID ni .env ichida tekshiring.",
              );
              return;
            }

            emitTelegramSessionStatus("authenticated");
            router.refresh();
          } catch {
            emitTelegramSessionStatus(
              "error",
              "Local dev sessiyani ochishda xatolik yuz berdi.",
            );
          }

          return;
        }

        console.info("[telegram-mini-app] initData missing", {
          hasUnsafeUser,
        });
        emitTelegramSessionStatus(
          "error",
          "Mini App faqat Telegram ichida ochilganda ishlaydi.",
        );
        return;
      }

      try {
        const ok = await openSession(initData);

        if (!ok) {
          emitTelegramSessionStatus(
            "error",
            "Telegram sessiyani tasdiqlab bo'lmadi. Qayta urinib ko'ring.",
          );
          return;
        }

        emitTelegramSessionStatus("authenticated");
        router.refresh();
      } catch {
        emitTelegramSessionStatus(
          "error",
          "Telegram sessiyani ochishda xatolik yuz berdi.",
        );
      }
    }

    emitTelegramSessionStatus("loading");
    void resolveSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (process.env.NODE_ENV === "production" || !devMode) {
    return null;
  }

  return (
    <div className="fixed right-3 top-3 z-50 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black tracking-wide text-amber-800 shadow-lg shadow-amber-100">
      DEV MINI APP
    </div>
  );
}
