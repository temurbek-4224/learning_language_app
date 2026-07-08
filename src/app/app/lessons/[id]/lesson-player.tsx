"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Keyboard,
  Layers3,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { completeLesson } from "./actions";

type LessonWord = {
  id: string;
  term: string;
  translation: string;
  definition: string | null;
  example: string | null;
};

type LessonPlayerProps = {
  lessonId: string;
  assignmentId: string;
  title: string;
  classTitle: string;
  words: LessonWord[];
};

type Step = "study" | "quiz" | "typing" | "example" | "result";
type ExerciseStep = "quiz" | "typing" | "example";
type Activity = "TRANSLATION_QUIZ" | "DEFINITION_TYPING" | "EXAMPLE";

type AttemptLog = {
  wordId: string;
  activity: Activity;
  answer: string;
  round: 1 | 2;
};

type ExerciseState = {
  queue: LessonWord[];
  index: number;
  round: 1 | 2;
  firstWrongIds: string[];
  failedIds: string[];
};

type Feedback = {
  step: ExerciseStep;
  wordId: string;
  answer: string;
  correct: boolean;
};

const stepMeta: { key: Step; label: string }[] = [
  { key: "study", label: "Study" },
  { key: "quiz", label: "Quiz" },
  { key: "typing", label: "Typing" },
  { key: "example", label: "Example" },
  { key: "result", label: "Result" },
];

const activityByStep: Record<ExerciseStep, Activity> = {
  quiz: "TRANSLATION_QUIZ",
  typing: "DEFINITION_TYPING",
  example: "EXAMPLE",
};

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hashValue(value: string) {
  return Array.from(value).reduce(
    (total, char) => total + char.charCodeAt(0) * 17,
    0,
  );
}

function shuffledBySeed<T>(items: T[], seed: string, getKey: (item: T) => string) {
  return [...items].sort(
    (a, b) => hashValue(`${seed}:${getKey(a)}`) - hashValue(`${seed}:${getKey(b)}`),
  );
}

function buildOptions(word: LessonWord, words: LessonWord[]) {
  const distractors = words
    .filter((candidate) => candidate.id !== word.id)
    .map((candidate) => candidate.translation)
    .filter(
      (translation, index, list) =>
        Boolean(translation) && list.indexOf(translation) === index,
    );
  const pickedDistractors = shuffledBySeed(
    distractors,
    word.id,
    (item) => item,
  ).slice(0, 3);

  return shuffledBySeed(
    [word.translation, ...pickedDistractors],
    `${word.id}:final`,
    (item) => item,
  );
}

function makeInitialExerciseState(words: LessonWord[]): ExerciseState {
  return {
    queue: words,
    index: 0,
    round: 1,
    firstWrongIds: [],
    failedIds: [],
  };
}

function nextStep(step: ExerciseStep): Step {
  if (step === "quiz") return "typing";
  if (step === "typing") return "example";
  return "result";
}

export function LessonPlayer({
  lessonId,
  assignmentId,
  title,
  classTitle,
  words,
}: LessonPlayerProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("study");
  const [studyIndex, setStudyIndex] = useState(0);
  const [exerciseStates, setExerciseStates] = useState<
    Record<ExerciseStep, ExerciseState>
  >({
    quiz: makeInitialExerciseState(words),
    typing: makeInitialExerciseState(words),
    example: makeInitialExerciseState(words),
  });
  const [attempts, setAttempts] = useState<AttemptLog[]>([]);
  const [typingAnswer, setTypingAnswer] = useState("");
  const [exampleAnswer, setExampleAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const optionsByWord = useMemo(
    () =>
      Object.fromEntries(
        words.map((word) => [word.id, buildOptions(word, words)]),
      ) as Record<string, string[]>,
    [words],
  );

  const failedByStep = {
    quiz: new Set(exerciseStates.quiz.failedIds),
    typing: new Set(exerciseStates.typing.failedIds),
    example: new Set(exerciseStates.example.failedIds),
  };
  const failedWordIds = new Set([
    ...failedByStep.quiz,
    ...failedByStep.typing,
    ...failedByStep.example,
  ]);
  const failedWords = words.filter((word) => failedWordIds.has(word.id));
  const learnedCount = words.length - failedWords.length;
  const accuracy = Math.round((learnedCount / words.length) * 100);
  const progressStep = stepMeta.findIndex((item) => item.key === step) + 1;

  function recordAttempt(stepName: ExerciseStep, word: LessonWord, answer: string) {
    setAttempts((current) => [
      ...current,
      {
        wordId: word.id,
        activity: activityByStep[stepName],
        answer,
        round: exerciseStates[stepName].round,
      },
    ]);
  }

  function advanceExercise(stepName: ExerciseStep, correct: boolean) {
    const state = exerciseStates[stepName];
    const word = state.queue[state.index];
    const firstWrongIds =
      state.round === 1 && !correct
        ? Array.from(new Set([...state.firstWrongIds, word.id]))
        : state.firstWrongIds;
    const failedIds =
      state.round === 2 && !correct
        ? Array.from(new Set([...state.failedIds, word.id]))
        : state.failedIds;

    setFeedback(null);
    setTypingAnswer("");
    setExampleAnswer("");

    if (state.index < state.queue.length - 1) {
      setExerciseStates((current) => ({
        ...current,
        [stepName]: {
          ...state,
          index: state.index + 1,
          firstWrongIds,
          failedIds,
        },
      }));
      return;
    }

    if (state.round === 1 && firstWrongIds.length > 0) {
      const retryQueue = words.filter((item) => firstWrongIds.includes(item.id));
      setExerciseStates((current) => ({
        ...current,
        [stepName]: {
          queue: retryQueue,
          index: 0,
          round: 2,
          firstWrongIds,
          failedIds,
        },
      }));
      return;
    }

    setExerciseStates((current) => ({
      ...current,
      [stepName]: {
        ...state,
        firstWrongIds,
        failedIds,
      },
    }));
    setStep(nextStep(stepName));
  }

  function submitQuiz(answer: string) {
    if (feedback) return;
    const state = exerciseStates.quiz;
    const word = state.queue[state.index];
    const correct =
      normalizeAnswer(answer) === normalizeAnswer(word.translation);

    recordAttempt("quiz", word, answer);
    setFeedback({ step: "quiz", wordId: word.id, answer, correct });
    window.setTimeout(() => advanceExercise("quiz", correct), 750);
  }

  function submitTyped(stepName: "typing" | "example", answer: string) {
    if (feedback || !answer.trim()) return;
    const state = exerciseStates[stepName];
    const word = state.queue[state.index];
    const correct = normalizeAnswer(answer) === normalizeAnswer(word.term);

    recordAttempt(stepName, word, answer);
    setFeedback({ step: stepName, wordId: word.id, answer, correct });
    window.setTimeout(() => advanceExercise(stepName, correct), 750);
  }

  function finishLesson() {
    setMessage("");

    startTransition(async () => {
      const result = await completeLesson({
        lessonId,
        studyWordIds: words.map((word) => word.id),
        attempts,
      });

      setMessage(result.message);

      if (result.ok) {
        router.push(`/app/assignments/${assignmentId}`);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 p-5 text-white shadow-xl shadow-indigo-200">
        <Link
          href={`/app/assignments/${assignmentId}`}
          className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-indigo-50 ring-1 ring-white/20"
        >
          <ArrowLeft className="size-3.5" />
          Assignment
        </Link>
        <h1 className="mt-4 text-2xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-indigo-50">{classTitle}</p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {stepMeta.map((item, index) => (
            <div key={item.key} className="space-y-1">
              <div
                className={`h-2 rounded-full transition-all ${
                  progressStep >= index + 1 ? "bg-white" : "bg-white/25"
                }`}
              />
              <p className="text-[9px] font-bold uppercase text-indigo-50">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {step === "study" ? (
        <StudyStep
          key={words[studyIndex].id}
          currentIndex={studyIndex}
          word={words[studyIndex]}
          wordsCount={words.length}
          onPrevious={() => setStudyIndex((value) => Math.max(0, value - 1))}
          onNext={() =>
            setStudyIndex((value) => Math.min(words.length - 1, value + 1))
          }
          onStartQuiz={() => setStep("quiz")}
        />
      ) : null}

      {step === "quiz" ? (
        <QuizStep
          state={exerciseStates.quiz}
          options={optionsByWord[exerciseStates.quiz.queue[exerciseStates.quiz.index].id] ?? []}
          feedback={feedback}
          onSelect={submitQuiz}
        />
      ) : null}

      {step === "typing" ? (
        <TypingStep
          state={exerciseStates.typing}
          answer={typingAnswer}
          feedback={feedback}
          onAnswer={setTypingAnswer}
          onSubmit={() => submitTyped("typing", typingAnswer)}
        />
      ) : null}

      {step === "example" ? (
        <ExampleStep
          state={exerciseStates.example}
          answer={exampleAnswer}
          feedback={feedback}
          onAnswer={setExampleAnswer}
          onSubmit={() => submitTyped("example", exampleAnswer)}
        />
      ) : null}

      {step === "result" ? (
        <ResultStep
          words={words}
          learnedCount={learnedCount}
          failedWords={failedWords}
          failedByStep={failedByStep}
          accuracy={accuracy}
          isPending={isPending}
          message={message}
          onFinish={finishLesson}
        />
      ) : null}
    </section>
  );
}

function StudyStep({
  currentIndex,
  word,
  wordsCount,
  onPrevious,
  onNext,
  onStartQuiz,
}: {
  currentIndex: number;
  word: LessonWord;
  wordsCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onStartQuiz: () => void;
}) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-300">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 text-center">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
            <span>Study Cards</span>
            <span>
              {currentIndex + 1} / {wordsCount}
            </span>
          </div>
          <p className="mt-8 text-4xl font-black text-slate-950">{word.term}</p>
          <p className="mt-3 text-2xl font-extrabold text-indigo-700">
            {word.translation}
          </p>
        </div>
        <div className="space-y-3 p-5">
          <InfoBlock label="Definition" value={word.definition || "Izoh kiritilmagan."} />
          <div className="rounded-2xl border border-indigo-100 bg-white p-4 text-sm leading-7 text-slate-700">
            <p className="mb-1 text-xs font-black uppercase tracking-wide text-indigo-500">
              Example
            </p>
            {word.example ? (
              <HighlightedExample example={word.example} term={word.term} />
            ) : (
              "Misol kiritilmagan."
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="h-12 rounded-2xl"
        >
          Oldingi
        </Button>
        {currentIndex === wordsCount - 1 ? (
          <Button
            type="button"
            size="lg"
            onClick={onStartQuiz}
            className="h-12 rounded-2xl"
          >
            Mashqni boshlash
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onNext}
            className="h-12 rounded-2xl"
          >
            Keyingi
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function QuizStep({
  state,
  options,
  feedback,
  onSelect,
}: {
  state: ExerciseState;
  options: string[];
  feedback: Feedback | null;
  onSelect: (answer: string) => void;
}) {
  const word = state.queue[state.index];

  return (
    <ExerciseShell
      title="Quiz"
      state={state}
      icon={<Sparkles className="size-5" />}
    >
      <h2 className="text-center text-4xl font-black text-slate-950">
        {word.term}
      </h2>
      {state.round === 2 ? <RetryNote /> : null}
      <div className="mt-6 space-y-3">
        {options.map((option) => {
          const selected =
            feedback?.step === "quiz" &&
            feedback.wordId === word.id &&
            feedback.answer === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              disabled={Boolean(feedback)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base font-extrabold shadow-sm transition-all active:scale-[0.99] ${
                selected && feedback?.correct
                  ? "scale-[1.01] border-emerald-300 bg-emerald-50 text-emerald-800 shadow-emerald-100"
                  : selected
                  ? "scale-[1.01] border-rose-300 bg-rose-50 text-rose-800 shadow-rose-100"
                  : "border-slate-200 bg-white text-slate-700 shadow-slate-100 hover:border-indigo-200 hover:bg-indigo-50"
              }`}
            >
              {selected ? (
                feedback?.correct ? (
                  <CheckCircle2 className="size-5 shrink-0 animate-bounce" />
                ) : (
                  <XCircle className="size-5 shrink-0 animate-pulse" />
                )
              ) : (
                <Circle className="size-5 shrink-0 text-slate-400" />
              )}
              {option}
            </button>
          );
        })}
      </div>
    </ExerciseShell>
  );
}

function TypingStep({
  state,
  answer,
  feedback,
  onAnswer,
  onSubmit,
}: {
  state: ExerciseState;
  answer: string;
  feedback: Feedback | null;
  onAnswer: (answer: string) => void;
  onSubmit: () => void;
}) {
  const word = state.queue[state.index];
  const activeFeedback = feedback?.step === "typing" && feedback.wordId === word.id;

  return (
    <ExerciseShell
      title="Typing"
      state={state}
      icon={<Keyboard className="size-5" />}
    >
      <div className="space-y-3">
        <InfoBlock label="Definition" value={word.definition || "Izoh kiritilmagan."} />
        <InfoBlock label="Uzbek" value={word.translation} />
      </div>
      {state.round === 2 ? <RetryNote /> : null}
      <LetterBoxes
        target={word.term}
        answer={answer}
        status={activeFeedback ? (feedback.correct ? "correct" : "wrong") : "idle"}
      />
      <form
        className="mt-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          value={answer}
          onChange={(event) => onAnswer(event.target.value)}
          disabled={Boolean(feedback)}
          autoFocus
          className={`h-13 w-full rounded-2xl border bg-white px-4 text-center text-xl font-black text-slate-950 outline-none ring-indigo-200 transition focus:border-indigo-400 focus:ring-4 ${
            activeFeedback && feedback.correct
              ? "border-emerald-300 bg-emerald-50"
              : activeFeedback
              ? "border-rose-300 bg-rose-50"
              : "border-slate-200"
          }`}
          placeholder="English word"
        />
        <Button
          type="submit"
          size="lg"
          disabled={!answer.trim() || Boolean(feedback)}
          className="h-12 w-full rounded-2xl"
        >
          Tekshirish
        </Button>
      </form>
    </ExerciseShell>
  );
}

function ExampleStep({
  state,
  answer,
  feedback,
  onAnswer,
  onSubmit,
}: {
  state: ExerciseState;
  answer: string;
  feedback: Feedback | null;
  onAnswer: (answer: string) => void;
  onSubmit: () => void;
}) {
  const word = state.queue[state.index];
  const activeFeedback =
    feedback?.step === "example" && feedback.wordId === word.id;

  return (
    <ExerciseShell
      title="Example"
      state={state}
      icon={<Layers3 className="size-5" />}
    >
      {state.round === 2 ? <RetryNote /> : null}
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <BlankSentence
          word={word}
          answer={answer}
          disabled={Boolean(feedback)}
          status={activeFeedback ? (feedback.correct ? "correct" : "wrong") : "idle"}
          onAnswer={onAnswer}
        />
        <Button
          type="submit"
          size="lg"
          disabled={!answer.trim() || Boolean(feedback)}
          className="h-12 w-full rounded-2xl"
        >
          Tekshirish
        </Button>
      </form>
    </ExerciseShell>
  );
}

function ResultStep({
  words,
  learnedCount,
  failedWords,
  failedByStep,
  accuracy,
  isPending,
  message,
  onFinish,
}: {
  words: LessonWord[];
  learnedCount: number;
  failedWords: LessonWord[];
  failedByStep: Record<ExerciseStep, Set<string>>;
  accuracy: number;
  isPending: boolean;
  message: string;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm shadow-slate-200">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
          <Trophy className="size-8" />
        </span>
        <h2 className="mt-4 text-2xl font-black text-slate-950">Natija</h2>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          {learnedCount} / {words.length} so'z o'rganildi
        </p>
        <p className="mt-3 text-5xl font-black text-indigo-700">{accuracy}%</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ResultMetric label="Jami so'zlar" value={words.length} />
        <ResultMetric label="O'rganildi" value={learnedCount} />
        <ResultMetric label="Xato so'zlar" value={failedWords.length} />
        <ResultMetric label="Aniqlik" value={`${accuracy}%`} />
      </div>
      {failedWords.length ? (
        <div className="rounded-3xl border border-rose-100 bg-white p-4 shadow-sm shadow-rose-100">
          <h3 className="font-black text-slate-950">Xato so'zlar</h3>
          <div className="mt-3 space-y-3">
            {failedWords.map((word) => {
              const failedSteps = [
                failedByStep.quiz.has(word.id) ? "Quiz" : null,
                failedByStep.typing.has(word.id) ? "Typing" : null,
                failedByStep.example.has(word.id) ? "Example" : null,
              ].filter(Boolean);

              return (
                <div
                  key={word.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-black text-slate-950">
                        {word.term}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-slate-600">
                        {word.translation}
                      </span>
                    </span>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">
                      {failedSteps.join(", ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {message}
        </div>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-2xl text-base"
        onClick={onFinish}
        disabled={isPending}
      >
        {isPending ? "Saqlanmoqda..." : "Lessonni yakunlash"}
      </Button>
    </div>
  );
}

function ExerciseShell({
  title,
  state,
  icon,
  children,
}: {
  title: string;
  state: ExerciseState;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200 animate-in fade-in slide-in-from-right-3 duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            {icon}
          </span>
          <span>
            <span className="block text-sm font-black text-slate-950">
              {title}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {state.index + 1} / {state.queue.length}
            </span>
          </span>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          {state.round === 1 ? "1-pass" : "Retry"}
        </span>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function HighlightedExample({
  example,
  term,
}: {
  example: string;
  term: string;
}) {
  const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");
  const parts = example.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        normalizeAnswer(part) === normalizeAnswer(term) ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-lg bg-indigo-100 px-1.5 py-0.5 font-black text-indigo-800"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function BlankSentence({
  word,
  answer,
  disabled,
  status,
  onAnswer,
}: {
  word: LessonWord;
  answer: string;
  disabled: boolean;
  status: "idle" | "correct" | "wrong";
  onAnswer: (answer: string) => void;
}) {
  const example = word.example || `${word.term}`;
  const regex = new RegExp(escapeRegExp(word.term), "i");
  const match = example.match(regex);
  const before = match ? example.slice(0, match.index) : "";
  const after = match ? example.slice((match.index || 0) + match[0].length) : example;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 p-5 text-xl font-black leading-10 text-slate-950">
      <span>{before}</span>
      <input
        value={answer}
        onChange={(event) => onAnswer(event.target.value)}
        disabled={disabled}
        autoFocus
        className={`mx-1 inline-block h-11 min-w-28 max-w-full rounded-2xl border bg-white px-3 text-center text-lg font-black outline-none ring-indigo-200 transition focus:border-indigo-400 focus:ring-4 ${
          status === "correct"
            ? "animate-bounce border-emerald-300 bg-emerald-50 text-emerald-800"
            : status === "wrong"
            ? "animate-pulse border-rose-300 bg-rose-50 text-rose-800"
            : "border-indigo-200 text-slate-950"
        }`}
        placeholder="..."
      />
      <span>{after}</span>
    </div>
  );
}

function LetterBoxes({
  target,
  answer,
  status,
}: {
  target: string;
  answer: string;
  status: "idle" | "correct" | "wrong";
}) {
  const letters = Array.from(target.replace(/\s/g, ""));
  const entered = Array.from(answer.replace(/\s/g, ""));

  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {letters.map((_, index) => (
        <span
          key={index}
          className={`flex size-10 items-center justify-center rounded-xl border text-lg font-black uppercase shadow-sm transition-all ${
            status === "correct"
              ? "scale-105 border-emerald-300 bg-emerald-50 text-emerald-800"
              : status === "wrong"
              ? "scale-105 border-rose-300 bg-rose-50 text-rose-800"
              : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          {entered[index] || ""}
        </span>
      ))}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function RetryNote() {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
      <RotateCcw className="size-4" />
      Xato qilingan so'zlar yana bir marta.
    </div>
  );
}

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}
