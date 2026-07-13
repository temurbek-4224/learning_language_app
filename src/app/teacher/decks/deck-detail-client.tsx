"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  generateBulkWordDetailsAction,
  generateWordDetailsAction,
  generateWordDetailsWithGeminiAction,
  importWordsAction,
  updateWordAction,
} from "./actions";

type DeckWord = {
  id: string;
  english: string;
  translation: string;
  definition: string | null;
  example: string | null;
  pronunciationText: string | null;
  audioUrl: string | null;
  partOfSpeech: WordPartOfSpeech;
  dataSource: WordDataSource;
  lookupStatus: LookupStatus;
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
  pronunciationText: string;
  audioUrl: string;
  partOfSpeech: WordPartOfSpeech;
  dataSource: WordDataSource;
  lookupStatus: LookupStatus;
};

type WordPartOfSpeech =
  | "AUTO"
  | "NOUN"
  | "VERB"
  | "ADJECTIVE"
  | "ADVERB"
  | "OTHER";
type WordDataSource = "DICTIONARY" | "CACHE" | "GEMINI" | "MANUAL";
type LookupStatus = "FOUND" | "NOT_FOUND" | "NEEDS_REVIEW" | "ERROR" | null;

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
type BulkAiMode = "SELECTED" | "MISSING_AI";

type BulkResult = {
  totalRequested: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  fromCache: number;
  fromDictionary: number;
  needsReview: number;
  needsReviewWords: Array<{
    id: string;
    english: string;
  }>;
  failedWords: Array<{
    id: string;
    english: string;
    errorCode: string;
  }>;
  error?: string;
};

type BulkProgressState = {
  phase: "confirm" | "running" | "complete";
  mode: BulkAiMode;
  wordIds: string[];
  completed: number;
  result: BulkResult;
};

const BULK_DICTIONARY_LIMIT = 50;
const BULK_DICTIONARY_BATCH_SIZE = 5;

function createEmptyBulkResult(totalRequested = 0): BulkResult {
  return {
    totalRequested,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    fromCache: 0,
    fromDictionary: 0,
    needsReview: 0,
    needsReviewWords: [],
    failedWords: [],
  };
}

const emptyDraft: WordDraft = {
  english: "",
  translation: "",
  definition: "",
  example: "",
  pronunciationText: "",
  audioUrl: "",
  partOfSpeech: "AUTO",
  dataSource: "MANUAL",
  lookupStatus: null,
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

function sourceLabel(source: WordDataSource) {
  return {
    DICTIONARY: "Dictionary",
    CACHE: "Cache",
    GEMINI: "Gemini",
    MANUAL: "Manual",
  }[source];
}

function createDraft(word?: DeckWord): WordDraft {
  return {
    english: word?.english ?? "",
    translation: word?.translation ?? "",
    definition: word?.definition ?? "",
    example: word?.example ?? "",
    pronunciationText: word?.pronunciationText ?? "",
    audioUrl: word?.audioUrl ?? "",
    partOfSpeech: word?.partOfSpeech ?? "AUTO",
    dataSource: word?.dataSource ?? "MANUAL",
    lookupStatus: word?.lookupStatus ?? null,
  };
}

function isDirty(draft: WordDraft, word?: DeckWord) {
  const initial = createDraft(word);

  return (
    draft.english !== initial.english ||
    draft.translation !== initial.translation ||
    draft.definition !== initial.definition ||
    draft.example !== initial.example ||
    draft.pronunciationText !== initial.pronunciationText ||
    draft.audioUrl !== initial.audioUrl ||
    draft.partOfSpeech !== initial.partOfSpeech
  );
}

export function DeckDetailClient({
  deck,
  error,
  importResult,
}: DeckDetailClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<WordModalState | null>(null);
  const [draft, setDraft] = useState<WordDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AiFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [importOpen, setImportOpen] = useState(Boolean(importResult));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgressState | null>(null);
  const [isBulkPending, setIsBulkPending] = useState(false);

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
  const visibleWordIds = useMemo(
    () => visibleWords.map((word) => word.id),
    [visibleWords],
  );
  const allVisibleSelected =
    visibleWordIds.length > 0 &&
    visibleWordIds.every((wordId) => selectedIds.has(wordId));
  const missingAiCount = deck.words.filter((word) => !hasAiDetails(word)).length;
  const missingWordIds = deck.words
    .filter((word) => !hasAiDetails(word))
    .map((word) => word.id);

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

  function toggleWordSelection(wordId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(wordId);
      } else {
        next.delete(wordId);
      }

      return next;
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const wordId of visibleWordIds) {
        if (checked) {
          next.add(wordId);
        } else {
          next.delete(wordId);
        }
      }

      return next;
    });
  }

  function requestSelectedBulkAi() {
    const wordIds = Array.from(selectedIds);

    if (wordIds.length === 0) {
      setBulkResult({
        ...createEmptyBulkResult(),
        error: "Select at least one word.",
      });
      return;
    }

    if (wordIds.length > BULK_DICTIONARY_LIMIT) {
      setBulkResult({
        ...createEmptyBulkResult(),
        error: `Bir martada maksimum ${BULK_DICTIONARY_LIMIT} ta so'z tanlang.`,
      });
      return;
    }

    setBulkProgress({
      phase: "confirm",
      mode: "SELECTED",
      wordIds,
      completed: 0,
      result: createEmptyBulkResult(wordIds.length),
    });
  }

  function requestMissingBulkAi() {
    if (missingAiCount === 0) {
      setBulkResult({
        ...createEmptyBulkResult(),
        error: "No words with missing details found.",
      });
      return;
    }

    const wordIds = missingWordIds.slice(0, BULK_DICTIONARY_LIMIT);
    setBulkProgress({
      phase: "confirm",
      mode: "MISSING_AI",
      wordIds,
      completed: 0,
      result: createEmptyBulkResult(wordIds.length),
    });
  }

  async function runBulkAi() {
    if (!bulkProgress || bulkProgress.phase !== "confirm") {
      return;
    }

    const payload = bulkProgress;
    let aggregate = createEmptyBulkResult(payload.wordIds.length);
    setBulkResult(null);
    setIsBulkPending(true);
    setBulkProgress({ ...payload, phase: "running", completed: 0 });

    for (
      let start = 0;
      start < payload.wordIds.length;
      start += BULK_DICTIONARY_BATCH_SIZE
    ) {
      const batchIds = payload.wordIds.slice(
        start,
        start + BULK_DICTIONARY_BATCH_SIZE,
      );

      try {
        const result = await generateBulkWordDetailsAction({
          deckId: deck.id,
          mode: "SELECTED",
          wordIds: batchIds,
        });

        if (result.error) {
          throw new Error(result.error);
        }

        aggregate = {
          ...aggregate,
          successCount: aggregate.successCount + result.successCount,
          failedCount: aggregate.failedCount + result.failedCount,
          skippedCount: aggregate.skippedCount + result.skippedCount,
          fromCache: aggregate.fromCache + result.fromCache,
          fromDictionary: aggregate.fromDictionary + result.fromDictionary,
          needsReview: aggregate.needsReview + result.needsReview,
          needsReviewWords: [
            ...aggregate.needsReviewWords,
            ...result.needsReviewWords,
          ],
          failedWords: [...aggregate.failedWords, ...result.failedWords],
        };
      } catch {
        const failedBatchWords = batchIds.map((id) => ({
          id,
          english: deck.words.find((word) => word.id === id)?.english ?? id,
          errorCode: "BATCH_ERROR",
        }));
        aggregate = {
          ...aggregate,
          failedCount: aggregate.failedCount + batchIds.length,
          failedWords: [...aggregate.failedWords, ...failedBatchWords],
        };
      }

      const completed = Math.min(
        start + batchIds.length,
        payload.wordIds.length,
      );
      setBulkProgress({
        ...payload,
        phase: "running",
        completed,
        result: aggregate,
      });
      router.refresh();
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      payload.wordIds.forEach((id) => next.delete(id));
      return next;
    });
    setBulkResult(aggregate);
    setBulkProgress({
      ...payload,
      phase: "complete",
      completed: payload.wordIds.length,
      result: aggregate,
    });
    setIsBulkPending(false);
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="grid gap-3 font-bold md:grid-cols-3">
            <span>Imported: {importResult.imported}</span>
            <span>Skipped: {importResult.skipped}</span>
            <span>Duplicates: {importResult.duplicate}</span>
          </div>
          <p className="mt-3 font-medium">
            Import tugadi. Endi dictionary fill orqali ta'rif va misollarni
            to'ldiring.
          </p>
        </div>
      ) : null}

      {bulkResult ? (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm font-bold",
            bulkResult.error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-blue-200 bg-blue-50 text-blue-800",
          )}
        >
          {bulkResult.error ? (
            bulkResult.error
          ) : (
            <div className="space-y-2">
              <p>
                Dictionary: {bulkResult.fromDictionary} ta, cache: {bulkResult.fromCache}
                ta, tekshirish kerak: {bulkResult.needsReview} ta, xato:{" "}
                {bulkResult.failedCount} ta, o'tkazildi: {bulkResult.skippedCount} ta
              </p>
              {bulkResult.needsReview > 0 ? (
                <p className="font-semibold">
                  Topilmagan so'zlarni qo'lda tekshiring yoki alohida Gemini fallback ishlating.
                </p>
              ) : null}
            </div>
          )}
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
                      Complete
                    </FilterButton>
                    <FilterButton active={filter === "missing"} onClick={() => setFilter("missing")}>
                      Missing details
                    </FilterButton>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-indigo-100">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) =>
                          toggleVisibleSelection(event.target.checked)
                        }
                        className="size-4 accent-indigo-600"
                      />
                      Select visible
                    </label>
                    <span className="text-sm font-bold text-indigo-800">
                      Selected: {selectedIds.size}
                    </span>
                    <span className="text-sm font-semibold text-slate-600">
                      Missing details: {missingAiCount}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={requestSelectedBulkAi}
                      disabled={isBulkPending || selectedIds.size === 0}
                    >
                      <Sparkles />
                      {isBulkPending
                        ? "Dictionary tekshirilmoqda..."
                        : "Tanlanganlarni to'ldirish"}
                    </Button>
                    <Button
                      type="button"
                      onClick={requestMissingBulkAi}
                      disabled={isBulkPending || missingAiCount === 0}
                    >
                      <Sparkles />
                      {isBulkPending
                        ? "Dictionary tekshirilmoqda..."
                        : "Bo'shlarini to'ldirish"}
                    </Button>
                  </div>
                </div>

                {isBulkPending ? (
                  <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                    Dictionary tekshirilmoqda... bu biroz vaqt olishi mumkin
                  </div>
                ) : null}

                <div className="mt-5 space-y-2">
                  {visibleWords.length > 0 ? (
                    visibleWords.map((word) => (
                      <WordRow
                        key={word.id}
                        word={word}
                        selected={selectedIds.has(word.id)}
                        onSelectedChange={(checked) =>
                          toggleWordSelection(word.id, checked)
                        }
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

      {bulkProgress ? (
        <BulkProgressModal
          progress={bulkProgress}
          onClose={() => {
            if (bulkProgress.phase !== "running") {
              setBulkProgress(null);
            }
          }}
          onConfirm={() => void runBulkAi()}
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

function WordRow({
  word,
  selected,
  onSelectedChange,
  onOpen,
}: {
  word: DeckWord;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onOpen: () => void;
}) {
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
      className="group grid cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center"
    >
      <label
        className="flex size-9 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
          className="size-4 accent-indigo-600"
          aria-label={`Select ${word.english}`}
        />
      </label>
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
          word.lookupStatus !== "NEEDS_REVIEW" && complete
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
            : "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
        )}
      >
        <CheckCircle2 className="size-3.5" />
        {word.lookupStatus === "NEEDS_REVIEW"
          ? "Needs review"
          : complete
            ? `${sourceLabel(word.dataSource)} · Found`
            : `${sourceLabel(word.dataSource)} · Missing`}
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

function BulkProgressModal({
  progress,
  onClose,
  onConfirm,
}: {
  progress: BulkProgressState;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const total = progress.wordIds.length;
  const percentage = total
    ? Math.round((progress.completed / total) * 100)
    : 0;
  const totalBatches = Math.ceil(total / BULK_DICTIONARY_BATCH_SIZE);
  const completedBatches = Math.ceil(
    progress.completed / BULK_DICTIONARY_BATCH_SIZE,
  );
  const isConfirm = progress.phase === "confirm";
  const isRunning = progress.phase === "running";
  const isComplete = progress.phase === "complete";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-6 shadow-2xl shadow-slate-950/20">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 ring-1 ring-indigo-100">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
              Bulk dictionary
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {isComplete
                ? "Bulk fill yakunlandi"
                : "Dictionary ma'lumotlarini to'ldirish"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {total} ta so'z {BULK_DICTIONARY_BATCH_SIZE} tadan kichik
              batchlarda tekshiriladi. Bitta xato qolgan so'zlarni to'xtatmaydi.
            </p>
          </div>
        </div>

        {!isConfirm ? (
          <div className="mt-6 space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-950">
                  {progress.completed} / {total} completed
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Batch {Math.min(completedBatches + (isRunning ? 1 : 0), totalBatches)} / {totalBatches}
                </p>
              </div>
              <p className="text-2xl font-black text-indigo-700">{percentage}%</p>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={progress.completed}
              className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 transition-[width] duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium leading-6 text-indigo-800">
            Cache birinchi tekshiriladi, keyin FreeDictionaryAPI ishlatiladi.
            Topilmagan so'zlar Gemini'ga avtomatik yuborilmaydi.
          </div>
        )}

        {!isConfirm ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProgressStat
              label="Cache"
              value={progress.result.fromCache}
              className="bg-sky-50 text-sky-800 ring-sky-100"
            />
            <ProgressStat
              label="Dictionary"
              value={progress.result.fromDictionary}
              className="bg-emerald-50 text-emerald-800 ring-emerald-100"
            />
            <ProgressStat
              label="Needs review"
              value={progress.result.needsReview}
              className="bg-amber-50 text-amber-800 ring-amber-100"
            />
            <ProgressStat
              label="Failed"
              value={progress.result.failedCount}
              className="bg-rose-50 text-rose-800 ring-rose-100"
            />
          </div>
        ) : null}

        {progress.result.needsReviewWords.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              Qo'lda tekshirish kerak
            </p>
            <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {progress.result.needsReviewWords.map((word) => (
                <span
                  key={word.id}
                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200"
                >
                  {word.english}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {progress.result.failedWords.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-900">Failed</p>
            <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs font-semibold text-rose-800">
              {progress.result.failedWords.map((word) => (
                <p key={word.id}>
                  {word.english} - {word.errorCode}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {isComplete ? (
          <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
            Summary: {progress.result.fromCache} cache, {progress.result.fromDictionary} dictionary,
            {" "}{progress.result.needsReview} needs review, {progress.result.failedCount} failed,
            {" "}{progress.result.skippedCount} skipped.
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          {!isRunning ? (
            <Button type="button" variant="outline" onClick={onClose}>
              {isComplete ? "Yopish" : "Cancel"}
            </Button>
          ) : null}
          {isConfirm ? (
            <Button type="button" onClick={onConfirm}>
              <Sparkles />
              Boshlash
            </Button>
          ) : null}
          {isRunning ? (
            <Button type="button" disabled>
              Dictionary tekshirilmoqda...
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProgressStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={cn("rounded-2xl p-3 ring-1", className)}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
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
    const manuallyEdited =
      key === "definition" || key === "example" || key === "pronunciationText";
    onDraftChange({
      ...draft,
      [key]: value,
      ...(manuallyEdited
        ? { dataSource: "MANUAL" as const, lookupStatus: "FOUND" as const }
        : {}),
    });
  }

  function fillWithDictionary() {
    setAiError("");

    if (!draft.english.trim()) {
      setAiError("English word is required before dictionary lookup.");
      return;
    }

    startTransition(async () => {
      const result = await generateWordDetailsAction({
        english: draft.english,
        partOfSpeech: draft.partOfSpeech,
        wordId: isEdit ? modal.word.id : undefined,
      });

      if (!result.ok) {
        setAiError(result.status === "NEEDS_REVIEW" ? "" : result.error);
        onDraftChange({
          ...draft,
          dataSource: result.source ?? "DICTIONARY",
          lookupStatus: result.status ?? "ERROR",
        });
        return;
      }

      onDraftChange({
        ...draft,
        definition: result.definition,
        example: result.example,
        pronunciationText: result.pronunciationText ?? "",
        audioUrl: result.audioUrl ?? "",
        partOfSpeech: result.partOfSpeech,
        dataSource: result.source,
        lookupStatus: result.status,
      });
    });
  }

  function fillWithGemini() {
    setAiError("");

    if (!draft.english.trim() || !draft.translation.trim()) {
      setAiError("English and translation are required before using Gemini.");
      return;
    }

    startTransition(async () => {
      const result = await generateWordDetailsWithGeminiAction({
        english: draft.english,
        translation: draft.translation,
        wordId: isEdit ? modal.word.id : undefined,
      });

      if (!result.ok) {
        setAiError(result.error);
        return;
      }

      onDraftChange({
        ...draft,
        definition: result.definition,
        example: result.example,
        dataSource: "GEMINI",
        lookupStatus: "FOUND",
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
          <input type="hidden" name="dataSource" value={draft.dataSource} />
          <input type="hidden" name="lookupStatus" value={draft.lookupStatus ?? ""} />
          <input type="hidden" name="audioUrl" value={draft.audioUrl} />
          {aiError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {aiError}
            </div>
          ) : null}

          {draft.lookupStatus === "NEEDS_REVIEW" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              So'z dictionary'dan topilmadi. Qo'lda tekshiring yoki Gemini fallback ishlating.
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

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">Part of speech</span>
            <select
              name="partOfSpeech"
              value={draft.partOfSpeech}
              onChange={(event) => updateDraft("partOfSpeech", event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            >
              <option value="AUTO">Auto</option>
              <option value="NOUN">Noun</option>
              <option value="VERB">Verb</option>
              <option value="ADJECTIVE">Adjective</option>
              <option value="ADVERB">Adverb</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={fillWithDictionary}
              disabled={isPending}
            >
              <BookOpen />
              {isPending ? "Tekshirilmoqda..." : "Dictionary bilan to'ldirish"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={fillWithGemini}
              disabled={isPending}
            >
              <Sparkles />
              Gemini fallback
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

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">Pronunciation</span>
            <input
              name="pronunciationText"
              value={draft.pronunciationText}
              onChange={(event) => updateDraft("pronunciationText", event.target.value)}
              placeholder="IPA pronunciation, when available"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-indigo-100 transition focus:border-indigo-400 focus:bg-white focus:ring-4"
            />
            <span className="text-xs font-medium text-slate-500">
              Source: {sourceLabel(draft.dataSource)}
              {draft.lookupStatus ? ` · ${draft.lookupStatus.replaceAll("_", " ")}` : ""}
            </span>
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
