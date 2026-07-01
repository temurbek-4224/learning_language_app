"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { generateWordDetailsAction } from "./actions";

type WordFormProps = {
  title: string;
  submitLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  initialValues?: {
    english: string;
    translation: string;
    definition?: string | null;
    example?: string | null;
  };
};

export function WordForm({
  title,
  submitLabel,
  action,
  initialValues,
}: WordFormProps) {
  const [english, setEnglish] = useState(initialValues?.english ?? "");
  const [translation, setTranslation] = useState(
    initialValues?.translation ?? "",
  );
  const [definition, setDefinition] = useState(initialValues?.definition ?? "");
  const [example, setExample] = useState(initialValues?.example ?? "");
  const [aiError, setAiError] = useState("");
  const [isPending, startTransition] = useTransition();

  function fillWithAi() {
    setAiError("");

    if (!english.trim() || !translation.trim()) {
      setAiError("English and translation are required before using AI.");
      return;
    }

    startTransition(async () => {
      const result = await generateWordDetailsAction({
        english,
        translation,
      });

      if (!result.ok) {
        setAiError(result.error);
        return;
      }

      setDefinition(result.definition);
      setExample(result.example);
    });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={fillWithAi}
          disabled={isPending}
        >
          <Sparkles />
          {isPending ? "AI ishlayapti..." : "AI bilan to'ldirish"}
        </Button>
      </div>

      {aiError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {aiError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">English</span>
          <input
            name="english"
            value={english}
            onChange={(event) => setEnglish(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">Translation</span>
          <input
            name="translation"
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-slate-700">Definition</span>
        <textarea
          name="definition"
          value={definition}
          onChange={(event) => setDefinition(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-slate-700">Example</span>
        <textarea
          name="example"
          value={example}
          onChange={(event) => setExample(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
        />
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
