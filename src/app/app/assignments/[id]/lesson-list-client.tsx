"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Lock, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type LessonCard = {
  id: string;
  title: string;
  wordsCount: number;
  completed: boolean;
  open: boolean;
  score: number | null;
  hasFailedWords: boolean;
};

export function LessonListClient({ lessons }: { lessons: LessonCard[] }) {
  const [selectedLesson, setSelectedLesson] = useState<LessonCard | null>(null);

  return (
    <>
      <div className="space-y-3">
        {lessons.map((lesson) =>
          lesson.completed ? (
            <CompletedLessonCard
              key={lesson.id}
              lesson={lesson}
              onReview={() => setSelectedLesson(lesson)}
            />
          ) : (
            <Link
              key={lesson.id}
              href={lesson.open ? `/app/lessons/${lesson.id}` : "#"}
              className={`flex items-center justify-between gap-3 rounded-3xl border p-4 shadow-sm ${
                lesson.open
                  ? "border-indigo-200 bg-white shadow-indigo-100"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
              aria-disabled={!lesson.open}
            >
              <LessonCardContent lesson={lesson} />
              <span
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  lesson.open
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {lesson.open ? "Boshlash" : "Locked"}
              </span>
            </Link>
          ),
        )}
      </div>

      {selectedLesson ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full rounded-3xl bg-white p-5 shadow-2xl sm:max-w-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
                  Qayta ko'rish
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Qanday qayta ishlamoqchisiz?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLesson(null)}
                className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"
                aria-label="Yopish"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <Button asChild size="lg" className="h-12 w-full rounded-2xl">
                <Link href={`/app/lessons/${selectedLesson.id}`}>
                  Hammasini boshidan
                </Link>
              </Button>
              {selectedLesson.hasFailedWords ? (
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="h-12 w-full rounded-2xl"
                >
                  <Link href={`/app/lessons/${selectedLesson.id}?mode=failed`}>
                    Faqat bilmagan so'zlarim
                  </Link>
                </Button>
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-800">
                  Sizda xato so'zlar yo'q.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CompletedLessonCard({
  lesson,
  onReview,
}: {
  lesson: LessonCard;
  onReview: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm shadow-emerald-100">
      <LessonCardContent lesson={lesson} />
      <button
        type="button"
        onClick={onReview}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700"
      >
        <RotateCcw className="size-4" />
        Qayta ko'rish
      </button>
    </div>
  );
}

function LessonCardContent({ lesson }: { lesson: LessonCard }) {
  return (
    <span className="flex min-w-0 gap-3">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
          lesson.completed
            ? "bg-emerald-100 text-emerald-700"
            : lesson.open
            ? "bg-indigo-50 text-indigo-600"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {lesson.completed ? (
          <CheckCircle2 className="size-5" />
        ) : lesson.open ? (
          <BookOpen className="size-5" />
        ) : (
          <Lock className="size-5" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{lesson.title}</span>
        <span className="mt-1 block text-sm">
          {lesson.wordsCount} words -{" "}
          {lesson.completed
            ? `Completed${lesson.score != null ? ` - ${lesson.score}%` : ""}`
            : lesson.open
            ? "Boshlash mumkin"
            : "Locked"}
        </span>
      </span>
    </span>
  );
}
