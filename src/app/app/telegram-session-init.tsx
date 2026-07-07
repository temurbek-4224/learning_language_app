"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function resolveSession() {
      if (cancelled) {
        return;
      }

      const webApp = window.Telegram?.WebApp;

      if (!webApp) {
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
        const response = await fetch("/api/app/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        if (!response.ok) {
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

  return null;
}
