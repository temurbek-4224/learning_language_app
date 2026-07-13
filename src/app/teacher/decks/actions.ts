"use server";

import {
  DictionaryLookupStatus,
  Prisma,
  UserRole,
  WordDataSource,
  WordPartOfSpeech,
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { lookupDictionary } from "@/lib/dictionary";
import { prisma } from "@/lib/prisma";

type AiDetailsResult =
  | {
      ok: true;
      definition: string;
      example: string;
      pronunciationText: string | null;
      audioUrl: string | null;
      partOfSpeech: WordPartOfSpeech;
      source: WordDataSource;
      status: DictionaryLookupStatus;
    }
  | {
      ok: false;
      error: string;
      source?: WordDataSource;
      status?: DictionaryLookupStatus;
    };

type BulkAiMode = "SELECTED" | "MISSING_AI";

type BulkAiResult = {
  ok: boolean;
  total: number;
  success: number;
  failed: number;
  skipped: number;
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

const BULK_DICTIONARY_BATCH_SIZE = 5;

type GeminiWordDetailsResult =
  | {
      ok: true;
      definition: string;
      example: string;
    }
  | {
      ok: false;
      error: string;
      errorCode: string;
    };

function redirectWithError(path: string, error: string) {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parsePartOfSpeech(value: unknown) {
  const parsed = String(value ?? "AUTO").toUpperCase();
  return Object.values(WordPartOfSpeech).includes(parsed as WordPartOfSpeech)
    ? (parsed as WordPartOfSpeech)
    : WordPartOfSpeech.AUTO;
}

function parseDataSource(value: unknown) {
  const parsed = String(value ?? "MANUAL").toUpperCase();
  return Object.values(WordDataSource).includes(parsed as WordDataSource)
    ? (parsed as WordDataSource)
    : WordDataSource.MANUAL;
}

function parseLookupStatus(value: unknown) {
  const parsed = String(value ?? "").toUpperCase();
  return Object.values(DictionaryLookupStatus).includes(
    parsed as DictionaryLookupStatus,
  )
    ? (parsed as DictionaryLookupStatus)
    : null;
}

async function requireOwnedDeck(deckId: string) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const deck = await prisma.deck.findFirst({
    where: {
      id: deckId,
      teacherId: teacher.id,
    },
    select: {
      id: true,
      teacherId: true,
      title: true,
    },
  });

  if (!deck) {
    notFound();
  }

  return { teacher, deck };
}

async function requireOwnedWord(wordId: string) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const word = await prisma.deckWord.findFirst({
    where: {
      id: wordId,
      deck: {
        teacherId: teacher.id,
      },
    },
    include: {
      deck: {
        select: {
          id: true,
          teacherId: true,
        },
      },
    },
  });

  if (!word) {
    notFound();
  }

  return { teacher, word };
}

async function findDuplicateTerm(deckId: string, english: string, exceptId?: string) {
  return prisma.deckWord.findFirst({
    where: {
      deckId,
      id: exceptId ? { not: exceptId } : undefined,
      term: {
        equals: english,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });
}

export async function createDeckAction(formData: FormData) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const title = String(formData.get("title") ?? "").trim();
  const description = cleanOptional(formData.get("description"));

  if (!title) {
    redirectWithError("/teacher/decks/new", "Deck title is required.");
  }

  try {
    const deck = await prisma.deck.create({
      data: {
        teacherId: teacher.id,
        title,
        description,
      },
      select: { id: true },
    });

    redirect(`/teacher/decks/${deck.id}`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithError("/teacher/decks/new", "You already have a deck with this title.");
    }

    throw error;
  }
}

export async function createWordAction(deckId: string, formData: FormData) {
  await requireOwnedDeck(deckId);

  const english = String(formData.get("english") ?? "").trim();
  const translation = String(formData.get("translation") ?? "").trim();
  const definition = cleanOptional(formData.get("definition"));
  const example = cleanOptional(formData.get("example"));
  const pronunciationText = cleanOptional(formData.get("pronunciationText"));
  const audioUrl = cleanOptional(formData.get("audioUrl"));
  const partOfSpeech = parsePartOfSpeech(formData.get("partOfSpeech"));
  const dataSource = parseDataSource(formData.get("dataSource"));
  const lookupStatus = parseLookupStatus(formData.get("lookupStatus"));
  const path = `/teacher/decks/${deckId}`;

  if (!english || !translation) {
    redirectWithError(path, "English and translation are required.");
  }

  const duplicate = await findDuplicateTerm(deckId, english);

  if (duplicate) {
    redirectWithError(path, "This English word already exists in this deck.");
  }

  const sortOrder = await prisma.deckWord.count({ where: { deckId } });

  try {
    await prisma.deckWord.create({
      data: {
        deckId,
        term: english,
        translation,
        definition,
        example,
        pronunciationText,
        audioUrl,
        partOfSpeech,
        dataSource,
        lookupStatus,
        sortOrder,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithError(path, "This English word already exists in this deck.");
    }

    throw error;
  }

  revalidatePath(path);
  redirect(path);
}

export async function updateWordAction(wordId: string, formData: FormData) {
  const { word } = await requireOwnedWord(wordId);

  const english = String(formData.get("english") ?? "").trim();
  const translation = String(formData.get("translation") ?? "").trim();
  const definition = cleanOptional(formData.get("definition"));
  const example = cleanOptional(formData.get("example"));
  const pronunciationText = cleanOptional(formData.get("pronunciationText"));
  const audioUrl = cleanOptional(formData.get("audioUrl"));
  const partOfSpeech = parsePartOfSpeech(formData.get("partOfSpeech"));
  const dataSource = parseDataSource(formData.get("dataSource"));
  const lookupStatus = parseLookupStatus(formData.get("lookupStatus"));
  const path = `/teacher/decks/${word.deckId}`;

  if (!english || !translation) {
    redirectWithError(path, "English and translation are required.");
  }

  const duplicate = await findDuplicateTerm(word.deckId, english, word.id);

  if (duplicate) {
    redirectWithError(path, "This English word already exists in this deck.");
  }

  try {
    await prisma.deckWord.update({
      where: { id: word.id },
      data: {
        term: english,
        translation,
        definition,
        example,
        pronunciationText,
        audioUrl,
        partOfSpeech,
        dataSource,
        lookupStatus,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithError(path, "This English word already exists in this deck.");
    }

    throw error;
  }

  revalidatePath(path);
  redirect(path);
}

export async function deleteWordAction(wordId: string) {
  const { word } = await requireOwnedWord(wordId);
  const path = `/teacher/decks/${word.deckId}`;

  await prisma.deckWord.delete({
    where: { id: word.id },
  });

  revalidatePath(path);
  redirect(path);
}

function parseImportLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(.+?)\s*(?:—|-|:)\s*(.+)$/);

  if (!match) {
    return null;
  }

  const english = match[1]?.trim();
  const translation = match[2]?.trim();

  if (!english || !translation) {
    return null;
  }

  return { english, translation };
}

export async function importWordsAction(deckId: string, formData: FormData) {
  await requireOwnedDeck(deckId);

  const text = String(formData.get("importText") ?? "");
  const lines = text.split(/\r?\n/);
  const path = `/teacher/decks/${deckId}`;
  let imported = 0;
  let skipped = 0;
  let duplicate = 0;
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = parseImportLine(line);

    if (!parsed) {
      if (line.trim()) {
        skipped += 1;
      }
      continue;
    }

    const normalized = parsed.english.toLowerCase();

    if (seen.has(normalized)) {
      duplicate += 1;
      continue;
    }

    seen.add(normalized);

    const existing = await findDuplicateTerm(deckId, parsed.english);

    if (existing) {
      duplicate += 1;
      continue;
    }

    try {
      await prisma.deckWord.create({
        data: {
          deckId,
          term: parsed.english,
          translation: parsed.translation,
          definition: null,
          example: null,
          sortOrder: await prisma.deckWord.count({ where: { deckId } }),
        },
      });
      imported += 1;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        duplicate += 1;
        continue;
      }

      throw error;
    }
  }

  revalidatePath(path);
  redirect(`${path}?imported=${imported}&skipped=${skipped}&duplicate=${duplicate}`);
}

function stripCodeFences(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseGeminiJson(text: string) {
  const cleaned = stripCodeFences(text);
  const parsed = JSON.parse(cleaned) as {
    definition?: unknown;
    example?: unknown;
  };

  if (typeof parsed.definition !== "string" || typeof parsed.example !== "string") {
    throw new Error("INVALID_JSON_SHAPE");
  }

  return {
    definition: parsed.definition.trim(),
    example: parsed.example.trim(),
  };
}

async function logAiUsage(
  teacherId: string,
  success: boolean,
  errorCode?: string,
  feature = "WORD_DETAILS",
  promptType = "DECK_WORD",
) {
  await prisma.aiUsageLog.create({
    data: {
      userId: teacherId,
      provider: "GEMINI",
      feature,
      promptType,
      success,
      errorCode,
    },
  });
}

async function requestGeminiWordDetails(
  english: string,
  translation: string,
): Promise<GeminiWordDetailsResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      ok: false as const,
      error: "Gemini API key is not configured.",
      errorCode: "MISSING_API_KEY",
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `Return JSON only for an English vocabulary word.
Word: "${english}"
Translation: "${translation}"
Return exactly:
{"definition":"short learner-friendly English definition","example":"simple sentence that includes the exact English word: ${english}"}
The example must include the exact English word "${english}".`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
      },
    );

    if (!response.ok) {
      console.warn("Gemini word details request failed", {
        GEMINI_MODEL: model,
        status: response.status,
        errorCode: `HTTP_${response.status}`,
        message: response.statusText || "Gemini request failed",
      });

      if (response.status === 429) {
        return {
          ok: false as const,
          error: "Gemini limiti vaqtincha to'ldi. Biroz kutib qayta urinib ko'ring.",
          errorCode: "HTTP_429",
        };
      }

      return {
        ok: false as const,
        error: "AI generation failed. Please try again.",
        errorCode: `HTTP_${response.status}`,
      };
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return {
        ok: false as const,
        error: "AI returned an empty response.",
        errorCode: "EMPTY_RESPONSE",
      };
    }

    const details = parseGeminiJson(text);

    if (!details.example.includes(english)) {
      return {
        ok: false as const,
        error: "AI example did not include the English word. Please try again.",
        errorCode: "EXAMPLE_MISSING_WORD",
      };
    }

    return { ok: true, ...details };
  } catch {
    return {
      ok: false as const,
      error: "AI generation failed. Please try again.",
      errorCode: "REQUEST_FAILED",
    };
  }
}

export async function generateWordDetailsAction(input: {
  english: string;
  partOfSpeech?: string;
  wordId?: string;
}): Promise<AiDetailsResult> {
  await requireRole(UserRole.TEACHER, "/teacher/login");
  const english = input.english.trim();

  if (!english) {
    return {
      ok: false,
      error: "English word is required before dictionary lookup.",
    };
  }

  const partOfSpeech = parsePartOfSpeech(input.partOfSpeech);
  const result = await lookupDictionary({ word: english, partOfSpeech });

  if (input.wordId) {
    const { word } = await requireOwnedWord(input.wordId);
    await prisma.deckWord.update({
      where: { id: word.id },
      data:
        result.status === DictionaryLookupStatus.FOUND
          ? {
              definition: result.definition,
              example: result.example,
              pronunciationText: result.pronunciationText,
              audioUrl: result.audioUrl,
              partOfSpeech: result.partOfSpeech,
              dataSource: result.source,
              lookupStatus: result.status,
            }
          : {
              dataSource: WordDataSource.DICTIONARY,
              lookupStatus: result.status,
            },
    });
    revalidatePath(`/teacher/decks/${word.deckId}`);
  }

  if (result.status !== DictionaryLookupStatus.FOUND || !result.definition) {
    const needsReview = result.status === DictionaryLookupStatus.NEEDS_REVIEW;
    return {
      ok: false,
      error: needsReview
        ? "So'z dictionary'dan topilmadi. Qo'lda tekshiring yoki Gemini fallback ishlating."
        : result.error ?? "Dictionary lookup failed. Please try again.",
      source: result.source,
      status: result.status,
    };
  }

  return {
    ok: true,
    definition: result.definition,
    example: result.example ?? "",
    pronunciationText: result.pronunciationText,
    audioUrl: result.audioUrl,
    partOfSpeech: result.partOfSpeech,
    source: result.source,
    status: result.status,
  };
}

export async function generateWordDetailsWithGeminiAction(input: {
  english: string;
  translation: string;
  wordId?: string;
}): Promise<AiDetailsResult> {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const english = input.english.trim();
  const translation = input.translation.trim();

  if (!english || !translation) {
    return {
      ok: false,
      error: "English and translation are required before using Gemini.",
    };
  }

  const result = await requestGeminiWordDetails(english, translation);
  if (!result.ok) {
    await logAiUsage(teacher.id, false, result.errorCode);
    return { ok: false, error: result.error };
  }

  if (input.wordId) {
    const { word } = await requireOwnedWord(input.wordId);
    await prisma.deckWord.update({
      where: { id: word.id },
      data: {
        definition: result.definition,
        example: result.example,
        dataSource: WordDataSource.GEMINI,
        lookupStatus: DictionaryLookupStatus.FOUND,
      },
    });
    revalidatePath(`/teacher/decks/${word.deckId}`);
  }

  await logAiUsage(teacher.id, true);
  return {
    ok: true,
    definition: result.definition,
    example: result.example,
    pronunciationText: null,
    audioUrl: null,
    partOfSpeech: WordPartOfSpeech.AUTO,
    source: WordDataSource.GEMINI,
    status: DictionaryLookupStatus.FOUND,
  };
}

export async function generateBulkWordDetailsAction(input: {
  deckId: string;
  mode: BulkAiMode;
  wordIds?: string[];
}): Promise<BulkAiResult> {
  await requireOwnedDeck(input.deckId);
  const uniqueWordIds = Array.from(new Set(input.wordIds ?? [])).slice(
    0,
    BULK_DICTIONARY_BATCH_SIZE,
  );

  if (input.mode === "SELECTED" && uniqueWordIds.length === 0) {
    return {
      ok: false,
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      totalRequested: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      fromCache: 0,
      fromDictionary: 0,
      needsReview: 0,
      needsReviewWords: [],
      failedWords: [],
      error: "Select at least one word.",
    };
  }

  const words = await prisma.deckWord.findMany({
    where: {
      deckId: input.deckId,
      ...(input.mode === "SELECTED" ? { id: { in: uniqueWordIds } } : {}),
      ...(input.mode === "MISSING_AI"
        ? {
            OR: [{ definition: null }, { definition: "" }, { example: null }, { example: "" }],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: BULK_DICTIONARY_BATCH_SIZE,
    select: {
      id: true,
      term: true,
      translation: true,
      definition: true,
      example: true,
      pronunciationText: true,
      audioUrl: true,
      partOfSpeech: true,
    },
  });

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let fromCache = 0;
  let fromDictionary = 0;
  let needsReview = 0;
  const needsReviewWords: BulkAiResult["needsReviewWords"] = [];
  const failedWords: BulkAiResult["failedWords"] = [];

  for (const word of words) {
    const hasDefinition = Boolean(word.definition?.trim());
    const hasExample = Boolean(word.example?.trim());

    if (hasDefinition && hasExample) {
      skippedCount += 1;
      continue;
    }

    if (!word.term.trim() || !word.translation.trim()) {
      failedCount += 1;
      failedWords.push({
        id: word.id,
        english: word.term,
        errorCode: "MISSING_WORD_INPUT",
      });
      continue;
    }

    try {
      const result = await lookupDictionary({
        word: word.term,
        partOfSpeech: word.partOfSpeech,
      });

      if (result.status === DictionaryLookupStatus.NEEDS_REVIEW) {
        needsReview += 1;
        needsReviewWords.push({ id: word.id, english: word.term });
        await prisma.deckWord.update({
          where: { id: word.id },
          data: {
            dataSource: WordDataSource.DICTIONARY,
            lookupStatus: DictionaryLookupStatus.NEEDS_REVIEW,
          },
        });
        continue;
      }

      if (result.status !== DictionaryLookupStatus.FOUND || !result.definition) {
        failedCount += 1;
        failedWords.push({
          id: word.id,
          english: word.term,
          errorCode: result.status,
        });
        await prisma.deckWord.update({
          where: { id: word.id },
          data: {
            dataSource: WordDataSource.DICTIONARY,
            lookupStatus: result.status,
          },
        });
        continue;
      }

      await prisma.deckWord.update({
        where: { id: word.id },
        data: {
          definition: hasDefinition ? word.definition : result.definition,
          example: hasExample ? word.example : result.example,
          pronunciationText:
            word.pronunciationText ?? result.pronunciationText,
          audioUrl: word.audioUrl ?? result.audioUrl,
          partOfSpeech:
            word.partOfSpeech === WordPartOfSpeech.AUTO
              ? result.partOfSpeech
              : word.partOfSpeech,
          dataSource: result.source,
          lookupStatus: DictionaryLookupStatus.FOUND,
        },
      });
      successCount += 1;
      if (result.source === WordDataSource.CACHE) {
        fromCache += 1;
      } else {
        fromDictionary += 1;
      }
    } catch (error) {
      failedCount += 1;
      failedWords.push({
        id: word.id,
        english: word.term,
        errorCode: "PROCESSING_ERROR",
      });
      console.warn("Dictionary bulk word processing failed", {
        wordId: word.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  revalidatePath(`/teacher/decks/${input.deckId}`);

  return {
    ok: failedCount === 0,
    total: words.length,
    success: successCount,
    failed: failedCount,
    skipped: skippedCount,
    totalRequested: words.length,
    successCount,
    failedCount,
    skippedCount,
    fromCache,
    fromDictionary,
    needsReview,
    needsReviewWords,
    failedWords,
  };
}
