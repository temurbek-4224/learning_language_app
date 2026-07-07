"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  joinClassByInviteCodeAction,
  joinClassInitialState,
} from "./actions";

export function JoinClassForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    joinClassByInviteCodeAction,
    joinClassInitialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status, state.message]);

  return (
    <form
      action={formAction}
      className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-sm shadow-indigo-100"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Link2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-black text-slate-950">Classga qo'shilish</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Telegram link, class_ kodi yoki invite codeni kiriting.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <input
          name="invite"
          placeholder="Class link yoki invite code kiriting"
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
          autoComplete="off"
        />
        <Button type="submit" className="w-full" disabled={pending}>
          <Plus />
          {pending ? "Tekshirilmoqda..." : "Classga qo'shilish"}
        </Button>
      </div>

      {state.message ? (
        <p
          className={`mt-3 rounded-2xl px-3 py-2 text-sm font-semibold ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
