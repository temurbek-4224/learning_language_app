"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  createWordAction,
  deleteWordAction,
  generateWordDetailsAction,
  importWordsAction,
  updateWordAction,
} from "./actions";

type DeckWord = {
  id: string;
  english: string;
  translation: string;
  definition: string | null;
  example: string | null;
  createdAt: string;
  updatedAt: string;
};

type DeckDetailClientProps = {
  deck: {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    wordsCount: number;
    words: DeckWord[];
  };
  error?: string;
  importResult: {
    imported: number;
    skipped: number;
    duplicate: number;
  } | null;
};

type WordDraft = {
  english: string;
  translation: string;
  definition: string;
  example: string;
};

type WordModalState =
  | {
      mode: "create";
      word?: undefined;
    }
  | {
      mode: "edit";
      word: DeckWord;
    };

type AiFilter = "all" | "complete" | "missing";

const emptyDraft: WordDraft = {
  english: "",
  translation: "",
  definition: "",
  example: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hasAiDetails(word: Pick<DeckWord, "definition" | "example">) {
  return Boolean(word.definition?.trim() && word.example?.trim());
}

function createDraft(word?: DeckWord): WordDraft {
  return {
    english: word?.english ?? "",
    translation: word?.translation ?? "",
    definition: word?.definition ?? "",
    example: word?.example ?? "",
  };
}

function isDirty(draft: WordDraft, word?: DeckWord) {
  const initial = createDraft(word);

  return (
    draft.english !== initial.english ||
    draft.translation !== initial.translation ||
    draft.definition !== initial.definition ||
    draft.example !== initial.example
  );
}

export function DeckDetailClient({
  deck,
  error,
  importResult,
}: DeckDetailClientProps) {
  const [modal, setModal] = useState<WordModalState | null>(null);
  const [draft, setDraft] = useState<WordDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AiFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [importOpen, setImportOpen] = useState(Boolean(importResult));

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return deck.words.filter((word) => {
      const matchesSearch =
        !query ||
        word.english.toLowerCase().includes(query) ||
        word.translation.toLowerCase().includes(query);
      const complete = hasAiDetails(word);
      const matchesFilter =
        filter === "all" ||
        (filter === "complete" && complete) ||
        (filter === "missing" && !complete);

      return matchesSearch && matchesFilter;
    });
  }, [deck.words, filter, search]);

  const visibleWords = showAll ? filteredWords : filteredWords.slice(0, 5);

  function openCreateModal() {
    setDraft(emptyDraft);
    setModal({ mode: "create" });
  }

  function openEditModal(word: DeckWord) {
    setDraft(createDraft(word));
    setModal({ mode: "edit", word });
  }

  function closeModal() {
    if (modal && isDirty(draft, modal.word)) {
      const shouldClose = window.confirm("Unsaved changes will be lost. Close?");

      if (!shouldClose) {
        return;
      }
    }

    setModal(null);
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-xl shadow-slate-200/70">
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 px-6 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Button asChild variant="ghost" size="sm" className="bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white">
                <Link href="/teacher/decks">
                  <ArrowLeft />
                  Back to decks
                </Link>
              </Button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-100">
                  Teacher deck
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  {deck.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-50">
                  {deck.description || "Manage this vocabulary deck before assignment workflows arrive."}
                </p>
              </div>
            </div>
            <Button type="button" size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50" onClick={openCreateModal}>
              <Plus />
              Add word
            </Button>
          </div>
        </div>

        <div className="grid gap-3 bg-slate-50/80 p-4 md:grid-cols-3">
          <StatCard label="Words" value={deck.wordsCount.toString()} />
          <StatCard label="Created" value={formatDate(deck.createdAt)} />
          <StatCard label="Updated" value={formatDate(deck.updatedAt)} />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {importResult ? (
        <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 md:grid-cols-3">
          <span>Imported: {importResult.imported}</span>
          <span>Skipped: {importResult.skipped}</span>
          <span>Duplicates: {importResult.duplicate}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-200/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Words</h2>
                    <p className="text-sm text-slate-600">
                      Compact list for reviewing, editing, and AI completion.
                    </p>
                  </div>
                </div>
              </div>
              <Button type="button" onClick={openCreateModal}>
                <Plus />
                Add word
              </Button>
            </div>

            {deck.words.length > 0 ? (
              <>
                <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <label className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setShowAll(false);
                      }}
                      placeholder="Search English or translation"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
                    />
                  </label>
                  <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold text-slate-600">
                    <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                      All
                    </FilterButton>
                    <FilterButton active={filter === "complete"} onClick={() => setFilter("complete")}>
                      AI complete
                    </FilterButton>
                    <FilterButton active={filter === "missing"} onClick={() => setFilter("missing")}>
                      Missing AI
                    </FilterButton>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {visibleWords.length > 0 ? (
                    visibleWords.map((word) => (
                      <WordRow
                        key={word.id}
                        word={word}
                        onOpen={() => openEditModal(word)}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                      <p className="font-bold text-slate-950">No matching words</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Try another search or filter.
                      </p>
                    </div>
                  )}
                </div>

                {filteredWords.length > 5 ? (
                  <div className="mt-5 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAll((current) => !current)}
                    >
                      {showAll ? (
                        <>
                          <ChevronUp />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown />
                          Hammasini ko'rish
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-5 rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/60 p-8 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                  <BookOpen className="size-6" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-slate-950">
                  Hali so'zlar yo'q
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  So'zlarni qo'lda qo'shing yoki copy-paste import qiling.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button type="button" onClick={openCreateModal}>
                    <Plus />
                    Add word
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
                    <Upload />
                    Import words
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <ImportPanel
          deckId={deck.id}
          isOpen={importOpen}
          onToggle={() => setImportOpen((current) => !current)}
        />
      </div>

      {modal ? (
        <WordModal
          deckId={deck.id}
          modal={modal}
          draft={draft}
          onDraftChange={setDraft}
          onClose={closeModal}
        />
      ) : null}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm shadow-slate-200/60">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg px-3 transition",
        active
          ? "bg-white text-indigo-700 shadow-sm"
          : "text-slate-600 hover:bg-white/70 hover:text-slate-950",
      )}
    >
      {children}
    </button>
  );
}

function WordRow({ word, onOpen }: { word: DeckWord; onOpen: () => void }) {
  const complete = hasAiDetails(word);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group grid cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-950">{word.english}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">English</p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-700">
          {word.translation}
        </p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">Translation</p>
      </div>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
          complete
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
            : "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
        )}
      >
        <CheckCircle2 className="size-3.5" />
        {complete ? "Complete" : "Missing AI"}
      </span>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}>
        <Pencil />
        Edit
      </Button>
    </div>
  );
}

function ImportPanel({
  deckId,
  isOpen,
  onToggle,
}: {
  deckId: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="h-fit rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-200/70">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
            <Upload className="size-5" />
          </span>
          <span>
            <span className="block text-lg font-bold text-slate-950">
              Import words
            </span>
            <span className="block text-sm text-slate-600">
              Paste a compact word list.
            </span>
          </span>
        </span>
        {isOpen ? (
          <ChevronUp className="size-5 text-slate-500" />
        ) : (
          <ChevronDown className="size-5 text-slate-500" />
        )}
      </button>

      {isOpen ? (
        <form action={importWordsAction.bind(null, deckId)} className="mt-5 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
            worker - ishchi
            <br />
            bread - non
          </div>
          <textarea
            name="importText"
            rows={8}
            placeholder={"worker - ishchi\nbread - non\nchoice - tanlov\ndoctor - shifokor"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            required
          />
          <Button type="submit" variant="secondary" className="w-full">
            <Upload />
            Import words
          </Button>
        </form>
      ) : null}
    </aside>
  );
}

function WordModal({
  deckId,
  modal,
  draft,
  onDraftChange,
  onClose,
}: {
  deckId: string;
  modal: WordModalState;
  draft: WordDraft;
  onDraftChange: (draft: WordDraft) => void;
  onClose: () => void;
}) {
  const [aiError, setAiError] = useState("");
  const [isPending, startTransition] = useTransition();
  const isEdit = modal.mode === "edit";
  const action = isEdit
    ? updateWordAction.bind(null, modal.word.id)
    : createWordAction.bind(null, deckId);

  function updateDraft(key: keyof WordDraft, value: string) {
    onDraftChange({ ...draft, [key]: value });
  }

  function fillWithAi() {
    setAiError("");

    if (!draft.english.trim() || !draft.translation.trim()) {
      setAiError("English and translation are required before using AI.");
      return;
    }

    startTransition(async () => {
      const result = await generateWordDetailsAction({
        english: draft.english,
        translation: draft.translation,
      });

      if (!result.ok) {
        setAiError(result.error);
        return;
      }

      onDraftChange({
        ...draft,
        definition: result.definition,
        example: result.example,
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
              {isEdit ? "Edit word" : "Add word"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {isEdit ? modal.word.english : "New vocabulary word"}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
            <X />
          </Button>
        </div>

        <form action={action} className="space-y-5 p-6">
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
                value={draft.english}
                onChange={(event) => updateDraft("english", event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">
                Translation
              </span>
              <input
                name="translation"
                value={draft.translation}
                onChange={(event) => updateDraft("translation", event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
                required
              />
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={fillWithAi}
              disabled={isPending}
            >
              <Sparkles />
              {isPending ? "AI ishlayapti..." : "AI bilan to'ldirish"}
            </Button>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">Definition</span>
            <textarea
              name="definition"
              value={draft.definition}
              onChange={(event) => updateDraft("definition", event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">Example</span>
            <textarea
              name="example"
              value={draft.example}
              onChange={(event) => updateDraft("example", event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {isEdit ? (
                <button
                  formAction={deleteWordAction.bind(null, modal.word.id)}
                  formNoValidate
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                  onClick={(event) => {
                    const confirmed = window.confirm(
                      "Delete this word? This cannot be undone.",
                    );

                    if (!confirmed) {
                      event.preventDefault();
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete word
                </button>
              ) : null}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {isEdit ? "Save changes" : "Save word"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
