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

function redirectWithError(path: string, error: string) {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
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

  await prisma.deckWord.update({
    where: { id: word.id },
    data: {
      term: english,
      translation,
      definition,
      example,
    },
  });

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
) {
  await prisma.aiUsageLog.create({
    data: {
      userId: teacherId,
      provider: "GEMINI",
      feature: "WORD_DETAILS",
      promptType: "DECK_WORD",
      success,
      errorCode,
    },
  });
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

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    await logAiUsage(teacher.id, false, "MISSING_API_KEY");
    return { ok: false, error: "Gemini API key is not configured." };
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
      await logAiUsage(teacher.id, false, `HTTP_${response.status}`);
      return { ok: false, error: "AI generation failed. Please try again." };
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
      await logAiUsage(teacher.id, false, "EMPTY_RESPONSE");
      return { ok: false, error: "AI returned an empty response." };
    }

    const details = parseGeminiJson(text);

    if (!details.example.includes(english)) {
      await logAiUsage(teacher.id, false, "EXAMPLE_MISSING_WORD");
      return {
        ok: false,
        error: "AI example did not include the English word. Please try again.",
      };
    }

    await logAiUsage(teacher.id, true);
    return { ok: true, ...details };
  } catch {
    await logAiUsage(teacher.id, false, "REQUEST_FAILED");
    return { ok: false, error: "AI generation failed. Please try again." };
  }
}
