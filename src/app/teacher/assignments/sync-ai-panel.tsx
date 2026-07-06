"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { syncAssignmentAiSnapshotsAction } from "./actions";

type SyncResult = {
  ok: boolean;
  templateUpdatedCount: number;
  classSnapshotUpdatedCount: number;
  templateWordsUpdated: number;
  classLessonWordsUpdated: number;
  skippedCount: number;
  noSourceAiCount: number;
  failedCount: number;
  error?: string;
};

type SyncAiPanelProps = {
  templateId: string;
  hasSourceDeck: boolean;
  hasStudentProgress: boolean;
};

export function SyncAiPanel({
  templateId,
  hasSourceDeck,
  hasStudentProgress,
}: SyncAiPanelProps) {
  const router = useRouter();
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSync() {
    setResult(null);
    setConfirmOpen(false);

    startTransition(async () => {
      const syncResult = await syncAssignmentAiSnapshotsAction({
        templateId,
        overwriteExisting,
      });

      setResult(syncResult);
      router.refresh();
    });
  }

  return (
    <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-200/70">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-violet-50 p-3 text-violet-600 ring-1 ring-violet-100">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            AI snapshot sync
          </h2>
          <p className="text-sm text-slate-600">
            Deckdagi ta'rif va misollarni snapshotlarga qo'lda yangilang.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <input
          type="checkbox"
          checked={overwriteExisting}
          onChange={(event) => setOverwriteExisting(event.target.checked)}
          className="mt-1 size-4 accent-indigo-600"
        />
        <span>
          <span className="block font-bold text-slate-950">
            Mavjud ta'rif va misollarni ham yangilash
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-600">
            O'chirilgan bo'lsa, faqat bo'sh definition/example maydonlari
            to'ldiriladi.
          </span>
        </span>
      </label>

      {result ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
            result.ok || result.templateUpdatedCount + result.classSnapshotUpdatedCount > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {result.templateUpdatedCount + result.classSnapshotUpdatedCount === 0 &&
          result.failedCount === 0 ? (
            "Yangilash uchun yangi AI ma'lumot topilmadi."
          ) : (
            <>
              Yangilandi: {result.templateUpdatedCount} ta template word,{" "}
              {result.classSnapshotUpdatedCount} ta class snapshot.
              {result.failedCount > 0 ? (
                <> Xato: {result.failedCount} ta.</>
              ) : null}
              {result.skippedCount > 0 || result.noSourceAiCount > 0 ? (
                <>
                  {" "}
                  O'tkazildi: {result.skippedCount} ta, source AI yo'q:{" "}
                  {result.noSourceAiCount} ta.
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!hasSourceDeck || isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <RefreshCw />
        {isPending ? "Yangilanmoqda..." : "AI ma'lumotlarni yangilash"}
      </Button>

      {!hasSourceDeck ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">
          Source deck topilmadi. Snapshotlarni deckdan yangilab bo'lmaydi.
        </p>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                  Sync snapshots
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Deckdan yangilash
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setConfirmOpen(false)}
                aria-label="Close sync confirmation"
              >
                <X />
              </Button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              Faqat definition va example maydonlari yangilanadi. English,
              translation, dars tartibi va word order o'zgarmaydi.
            </p>

            {hasStudentProgress ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                Bu assignmentni ba'zi studentlar boshlagan. Faqat ta'rif va
                misollar yangilanadi. Dars tartibi o'zgarmaydi. Davom etasizmi?
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="button" onClick={runSync} disabled={isPending}>
                <RefreshCw />
                {isPending ? "Yangilanmoqda..." : "Davom etish"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
