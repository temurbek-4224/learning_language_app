"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export function TelegramSessionInit() {
  const router = useRouter();

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;

    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    if (!initData) {
      return;
    }

    void fetch("/api/app/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    }).then((response) => {
      if (response.ok) {
        router.refresh();
      }
    });
  }, [router]);

  return null;
}
