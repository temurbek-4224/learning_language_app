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
  Trophy,
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

type Step = "study" | "quiz" | "typing" | "result";

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildOptions(word: LessonWord, words: LessonWord[]) {
  const distractors = words
    .filter((candidate) => candidate.id !== word.id)
    .map((candidate) => candidate.translation)
    .filter(
      (translation, index, list) =>
        translation && list.indexOf(translation) === index,
    )
    .slice(0, 3);

  return [word.translation, ...distractors].sort((a, b) =>
    a.localeCompare(b, "uz"),
  );
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
  const [quizIndex, setQuizIndex] = useState(0);
  const [typingIndex, setTypingIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [typingAnswers, setTypingAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const optionsByWord = useMemo(
    () =>
      Object.fromEntries(
        words.map((word) => [word.id, buildOptions(word, words)]),
      ) as Record<string, string[]>,
    [words],
  );

  const quizCorrect = words.filter(
    (word) =>
      normalizeAnswer(quizAnswers[word.id] ?? "") ===
      normalizeAnswer(word.translation),
  ).length;
  const typingCorrect = words.filter(
    (word) =>
      normalizeAnswer(typingAnswers[word.id] ?? "") ===
      normalizeAnswer(word.translation),
  ).length;
  const correctCount = quizCorrect + typingCorrect;
  const totalQuestions = words.length * 2;
  const accuracy = Math.round((correctCount / totalQuestions) * 100);
  const progressStep =
    step === "study" ? 1 : step === "quiz" ? 2 : step === "typing" ? 3 : 4;

  function finishLesson() {
    setMessage("");

    startTransition(async () => {
      const result = await completeLesson({
        lessonId,
        quizAnswers: words.map((word) => ({
          wordId: word.id,
          answer: quizAnswers[word.id] ?? "",
        })),
        typingAnswers: words.map((word) => ({
          wordId: word.id,
          answer: typingAnswers[word.id] ?? "",
        })),
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
        <div className="mt-4 grid grid-cols-4 gap-2">
          {["Cards", "Quiz", "Typing", "Result"].map((label, index) => (
            <div key={label} className="space-y-1">
              <div
                className={`h-2 rounded-full ${
                  progressStep >= index + 1 ? "bg-white" : "bg-white/25"
                }`}
              />
              <p className="text-[10px] font-bold uppercase text-indigo-50">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {step === "study" ? (
        <StudyStep
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
          currentIndex={quizIndex}
          word={words[quizIndex]}
          wordsCount={words.length}
          options={optionsByWord[words[quizIndex].id] ?? []}
          selectedAnswer={quizAnswers[words[quizIndex].id] ?? ""}
          onSelect={(answer) =>
            setQuizAnswers((current) => ({
              ...current,
              [words[quizIndex].id]: answer,
            }))
          }
          onPrevious={() => setQuizIndex((value) => Math.max(0, value - 1))}
          onNext={() => {
            if (quizIndex === words.length - 1) {
              setStep("typing");
              return;
            }

            setQuizIndex((value) => value + 1);
          }}
        />
      ) : null}

      {step === "typing" ? (
        <TypingStep
          currentIndex={typingIndex}
          word={words[typingIndex]}
          wordsCount={words.length}
          answer={typingAnswers[words[typingIndex].id] ?? ""}
          onAnswer={(answer) =>
            setTypingAnswers((current) => ({
              ...current,
              [words[typingIndex].id]: answer,
            }))
          }
          onPrevious={() => setTypingIndex((value) => Math.max(0, value - 1))}
          onNext={() => {
            if (typingIndex === words.length - 1) {
              setStep("result");
              return;
            }

            setTypingIndex((value) => value + 1);
          }}
        />
      ) : null}

      {step === "result" ? (
        <ResultStep
          wordsCount={words.length}
          totalQuestions={totalQuestions}
          correctCount={correctCount}
          accuracy={accuracy}
          quizCorrect={quizCorrect}
          typingCorrect={typingCorrect}
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
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
          <span>Study Cards</span>
          <span>
            {currentIndex + 1}/{wordsCount}
          </span>
        </div>
        <div className="mt-6 rounded-3xl bg-indigo-50 p-5 text-center">
          <p className="text-3xl font-black text-slate-950">{word.term}</p>
          <p className="mt-3 text-xl font-extrabold text-indigo-700">
            {word.translation}
          </p>
        </div>
        {word.definition ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
            {word.definition}
          </p>
        ) : null}
        {word.example ? (
          <p className="mt-3 rounded-2xl border border-slate-200 p-4 text-sm leading-6 text-slate-600">
            {word.example}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onPrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        {currentIndex === wordsCount - 1 ? (
          <Button type="button" size="lg" onClick={onStartQuiz}>
            Start Quiz
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={onNext}>
            Next
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function QuizStep({
  currentIndex,
  word,
  wordsCount,
  options,
  selectedAnswer,
  onSelect,
  onPrevious,
  onNext,
}: {
  currentIndex: number;
  word: LessonWord;
  wordsCount: number;
  options: string[];
  selectedAnswer: string;
  onSelect: (answer: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
          <span>Translation Quiz</span>
          <span>
            {currentIndex + 1}/{wordsCount}
          </span>
        </div>
        <h2 className="mt-5 text-2xl font-black leading-tight text-slate-950">
          "{word.term}" so'zining tarjimasi qaysi?
        </h2>
        <div className="mt-5 space-y-3">
          {options.map((option) => {
            const selected = selectedAnswer === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(option)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold shadow-sm ${
                  selected
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-indigo-100"
                    : "border-slate-200 bg-white text-slate-700 shadow-slate-100"
                }`}
              >
                {selected ? (
                  <CheckCircle2 className="size-5 shrink-0" />
                ) : (
                  <Circle className="size-5 shrink-0 text-slate-400" />
                )}
                {option}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onPrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onNext}
          disabled={!selectedAnswer}
        >
          {currentIndex === wordsCount - 1 ? "Typing" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function TypingStep({
  currentIndex,
  word,
  wordsCount,
  answer,
  onAnswer,
  onPrevious,
  onNext,
}: {
  currentIndex: number;
  word: LessonWord;
  wordsCount: number;
  answer: string;
  onAnswer: (answer: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
          <span>Definition Typing</span>
          <span>
            {currentIndex + 1}/{wordsCount}
          </span>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-3xl bg-slate-50 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <Keyboard className="size-5" />
          </span>
          <span>
            <span className="block text-2xl font-black text-slate-950">
              {word.term}
            </span>
            <span className="mt-2 block text-sm font-semibold leading-6 text-slate-600">
              {word.definition || "Tarjimasini yozing."}
            </span>
          </span>
        </div>
        <label className="mt-5 block text-sm font-bold text-slate-700">
          Uzbek translation
          <input
            value={answer}
            onChange={(event) => onAnswer(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-950 outline-none ring-indigo-200 transition focus:border-indigo-400 focus:ring-4"
            placeholder="Javobni yozing"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onPrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onNext}
          disabled={!answer.trim()}
        >
          {currentIndex === wordsCount - 1 ? "Result" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function ResultStep({
  wordsCount,
  totalQuestions,
  correctCount,
  accuracy,
  quizCorrect,
  typingCorrect,
  isPending,
  message,
  onFinish,
}: {
  wordsCount: number;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  quizCorrect: number;
  typingCorrect: number;
  isPending: boolean;
  message: string;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm shadow-slate-200">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
          <Trophy className="size-8" />
        </span>
        <h2 className="mt-4 text-2xl font-black text-slate-950">Result</h2>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          {correctCount}/{totalQuestions} correct
        </p>
        <p className="mt-3 text-5xl font-black text-indigo-700">{accuracy}%</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ResultMetric icon={<Layers3 />} label="Study words" value={wordsCount} />
        <ResultMetric label="Total questions" value={totalQuestions} />
        <ResultMetric label="Quiz correct" value={quizCorrect} />
        <ResultMetric label="Typing correct" value={typingCorrect} />
      </div>
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

function ResultMetric({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200">
      {icon ? (
        <div className="mb-3 flex size-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      ) : null}
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}
