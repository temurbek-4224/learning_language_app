"use server";

import { Prisma, UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AiDetailsResult =
  | {
      ok: true;
      definition: string;
      example: string;
    }
  | {
      ok: false;
      error: string;
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
  failedWords: Array<{
    id: string;
    english: string;
    errorCode: string;
  }>;
  error?: string;
};

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

const BULK_AI_DELAY_MS = 2000;
const GEMINI_RATE_LIMIT_DELAY_MS = 15000;
const GEMINI_MAX_RETRIES = 1;

function redirectWithError(path: string, error: string) {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

async function generateWithRetry(word: {
  term: string;
  translation: string;
}) {
  let lastResult: GeminiWordDetailsResult | null = null;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    const result = await requestGeminiWordDetails(
      word.term.trim(),
      word.translation.trim(),
    );

    if (result.ok) {
      return result;
    }

    lastResult = result;

    if (result.errorCode !== "HTTP_429" || attempt >= GEMINI_MAX_RETRIES) {
      return result;
    }

    console.warn("Gemini rate limit hit during bulk word details; retrying", {
      GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      errorCode: result.errorCode,
      message: result.error,
      retryDelayMs: GEMINI_RATE_LIMIT_DELAY_MS,
      attempt: attempt + 1,
    });
    await sleep(GEMINI_RATE_LIMIT_DELAY_MS);
  }

  return (
    lastResult ?? {
      ok: false as const,
      error: "AI generation failed. Please try again.",
      errorCode: "REQUEST_FAILED",
    }
  );
}

export async function generateWordDetailsAction(input: {
  english: string;
  translation: string;
}): Promise<AiDetailsResult> {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const english = input.english.trim();
  const translation = input.translation.trim();

  if (!english || !translation) {
    return {
      ok: false,
      error: "English and translation are required before using AI.",
    };
  }

  const result = await requestGeminiWordDetails(english, translation);

  if (!result.ok) {
    await logAiUsage(teacher.id, false, result.errorCode);
    return { ok: false, error: result.error };
  }

  await logAiUsage(teacher.id, true);
  return {
    ok: true,
    definition: result.definition,
    example: result.example,
  };
}

export async function generateBulkWordDetailsAction(input: {
  deckId: string;
  mode: BulkAiMode;
  wordIds?: string[];
}): Promise<BulkAiResult> {
  const { teacher } = await requireOwnedDeck(input.deckId);
  const uniqueWordIds = Array.from(new Set(input.wordIds ?? []));

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
    select: {
      id: true,
      term: true,
      translation: true,
      definition: true,
      example: true,
    },
  });

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let requestCount = 0;
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
      await logAiUsage(
        teacher.id,
        false,
        "MISSING_WORD_INPUT",
        "BULK_WORD_DETAILS",
        "DECK_WORD_BULK",
      );
      continue;
    }

    if (requestCount > 0) {
      await sleep(BULK_AI_DELAY_MS);
    }

    requestCount += 1;
    const result = await generateWithRetry(word);

    if (!result.ok) {
      failedCount += 1;
      failedWords.push({
        id: word.id,
        english: word.term,
        errorCode: result.errorCode,
      });
      await logAiUsage(
        teacher.id,
        false,
        result.errorCode,
        "BULK_WORD_DETAILS",
        "DECK_WORD_BULK",
      );
      continue;
    }

    await prisma.deckWord.update({
      where: { id: word.id },
      data: {
        definition: hasDefinition ? word.definition : result.definition,
        example: hasExample ? word.example : result.example,
      },
    });
    successCount += 1;
    await logAiUsage(
      teacher.id,
      true,
      undefined,
      "BULK_WORD_DETAILS",
      "DECK_WORD_BULK",
    );
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
    failedWords,
  };
}
