import {
  DictionaryLookupStatus,
  Prisma,
  WordDataSource,
  WordPartOfSpeech,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DICTIONARY_API_BASE = "https://freedictionaryapi.com/api/v1";
const DICTIONARY_TIMEOUT_MS = 8_000;

type ApiPronunciation = {
  type?: unknown;
  text?: unknown;
  audio?: unknown;
  audioUrl?: unknown;
  url?: unknown;
};

type ApiSense = {
  definition?: unknown;
  examples?: unknown;
  subsenses?: unknown;
};

type ApiEntry = {
  language?: { code?: unknown };
  partOfSpeech?: unknown;
  pronunciations?: unknown;
  senses?: unknown;
};

type ApiResponse = {
  word?: unknown;
  entries?: unknown;
};

export type DictionaryLookupResult = {
  definition: string | null;
  example: string | null;
  pronunciationText: string | null;
  audioUrl: string | null;
  partOfSpeech: WordPartOfSpeech;
  source: typeof WordDataSource.DICTIONARY | typeof WordDataSource.CACHE;
  status: DictionaryLookupStatus;
  normalizedWord: string;
  error?: string;
};

type Candidate = Omit<
  DictionaryLookupResult,
  "source" | "status" | "normalizedWord" | "error"
> & {
  score: number;
  rawJson: Prisma.InputJsonValue;
};

export function normalizeDictionaryWord(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapPartOfSpeech(value: unknown): WordPartOfSpeech {
  const normalized = cleanString(value)?.toLowerCase();

  if (normalized === "noun" || normalized === "proper noun") {
    return WordPartOfSpeech.NOUN;
  }
  if (normalized === "verb") {
    return WordPartOfSpeech.VERB;
  }
  if (normalized === "adjective") {
    return WordPartOfSpeech.ADJECTIVE;
  }
  if (normalized === "adverb") {
    return WordPartOfSpeech.ADVERB;
  }
  return WordPartOfSpeech.OTHER;
}

function escapedWordPattern(word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
}

function flattenSenses(value: unknown): ApiSense[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((sense) => {
    if (!sense || typeof sense !== "object") {
      return [];
    }

    const typedSense = sense as ApiSense;
    return [typedSense, ...flattenSenses(typedSense.subsenses)];
  });
}

function getPronunciation(entry: ApiEntry) {
  const pronunciations = Array.isArray(entry.pronunciations)
    ? (entry.pronunciations as ApiPronunciation[])
    : [];
  const preferred =
    pronunciations.find(
      (item) => cleanString(item.type)?.toLowerCase() === "ipa" && cleanString(item.text),
    ) ?? pronunciations.find((item) => cleanString(item.text));
  const withAudio = pronunciations.find(
    (item) =>
      cleanString(item.audioUrl) || cleanString(item.audio) || cleanString(item.url),
  );

  return {
    pronunciationText: preferred ? cleanString(preferred.text) : null,
    audioUrl: withAudio
      ? cleanString(withAudio.audioUrl) ??
        cleanString(withAudio.audio) ??
        cleanString(withAudio.url)
      : null,
  };
}

function buildCandidates(
  response: ApiResponse,
  normalizedWord: string,
  requestedPartOfSpeech: WordPartOfSpeech,
) {
  if (!Array.isArray(response.entries)) {
    return [];
  }

  const wordPattern = escapedWordPattern(normalizedWord);
  const candidates: Candidate[] = [];

  for (const value of response.entries) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const entry = value as ApiEntry;
    if (cleanString(entry.language?.code)?.toLowerCase() !== "en") {
      continue;
    }

    const partOfSpeech = mapPartOfSpeech(entry.partOfSpeech);
    const pronunciation = getPronunciation(entry);

    for (const sense of flattenSenses(entry.senses)) {
      const definition = cleanString(sense.definition);
      if (!definition) {
        continue;
      }

      const examples = Array.isArray(sense.examples)
        ? sense.examples.map(cleanString).filter((item): item is string => Boolean(item))
        : [];
      const example =
        examples.find((item) => wordPattern.test(item)) ?? examples[0] ?? null;
      let score = 1_000;

      if (
        requestedPartOfSpeech !== WordPartOfSpeech.AUTO &&
        partOfSpeech === requestedPartOfSpeech
      ) {
        score += 500;
      }
      if (example) {
        score += 120;
      }
      if (example && wordPattern.test(example)) {
        score += 180;
      }
      if (definition.length >= 20 && definition.length <= 140) {
        score += 80;
      }
      score -= Math.min(definition.length, 500) / 10;

      candidates.push({
        definition,
        example,
        ...pronunciation,
        partOfSpeech,
        score,
        rawJson: {
          partOfSpeech: cleanString(entry.partOfSpeech),
          sense: JSON.parse(JSON.stringify(sense)) as Prisma.InputJsonValue,
        },
      });
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

function cacheScore(
  entry: {
    definition: string | null;
    example: string | null;
    partOfSpeech: WordPartOfSpeech;
  },
  normalizedWord: string,
  requestedPartOfSpeech: WordPartOfSpeech,
) {
  let score = entry.definition ? 1_000 : 0;
  if (
    requestedPartOfSpeech !== WordPartOfSpeech.AUTO &&
    entry.partOfSpeech === requestedPartOfSpeech
  ) {
    score += 500;
  }
  if (entry.example) {
    score += 120;
  }
  if (entry.example && escapedWordPattern(normalizedWord).test(entry.example)) {
    score += 180;
  }
  if (entry.definition && entry.definition.length <= 140) {
    score += 80;
  }
  return score;
}

export async function lookupDictionary(input: {
  word: string;
  partOfSpeech?: WordPartOfSpeech;
}): Promise<DictionaryLookupResult> {
  const normalizedWord = normalizeDictionaryWord(input.word);
  const requestedPartOfSpeech = input.partOfSpeech ?? WordPartOfSpeech.AUTO;
  const emptyResult = {
    definition: null,
    example: null,
    pronunciationText: null,
    audioUrl: null,
    partOfSpeech: requestedPartOfSpeech,
    normalizedWord,
  };

  if (!normalizedWord) {
    return {
      ...emptyResult,
      source: WordDataSource.DICTIONARY,
      status: DictionaryLookupStatus.NEEDS_REVIEW,
    };
  }

  const cachedEntries = await prisma.dictionaryEntryCache.findMany({
    where: {
      normalizedWord,
      language: "en",
      definition: { not: null },
    },
  });
  const cached = cachedEntries.sort(
    (left, right) =>
      cacheScore(right, normalizedWord, requestedPartOfSpeech) -
      cacheScore(left, normalizedWord, requestedPartOfSpeech),
  )[0];

  if (cached?.definition?.trim()) {
    return {
      definition: cached.definition,
      example: cached.example,
      pronunciationText: cached.pronunciationText,
      audioUrl: cached.audioUrl,
      partOfSpeech: cached.partOfSpeech,
      source: WordDataSource.CACHE,
      status: DictionaryLookupStatus.FOUND,
      normalizedWord,
    };
  }

  try {
    const response = await fetch(
      `${DICTIONARY_API_BASE}/entries/en/${encodeURIComponent(normalizedWord)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(DICTIONARY_TIMEOUT_MS),
      },
    );

    if (response.status === 404) {
      return {
        ...emptyResult,
        source: WordDataSource.DICTIONARY,
        status: DictionaryLookupStatus.NEEDS_REVIEW,
      };
    }

    if (!response.ok) {
      return {
        ...emptyResult,
        source: WordDataSource.DICTIONARY,
        status: DictionaryLookupStatus.ERROR,
        error: `Dictionary API returned HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as ApiResponse;
    const candidate = buildCandidates(data, normalizedWord, requestedPartOfSpeech)[0];

    if (!candidate?.definition) {
      return {
        ...emptyResult,
        source: WordDataSource.DICTIONARY,
        status: DictionaryLookupStatus.NEEDS_REVIEW,
      };
    }

    await prisma.dictionaryEntryCache.upsert({
      where: {
        normalizedWord_language_partOfSpeech: {
          normalizedWord,
          language: "en",
          partOfSpeech: candidate.partOfSpeech,
        },
      },
      create: {
        word: cleanString(data.word) ?? input.word.trim(),
        normalizedWord,
        language: "en",
        partOfSpeech: candidate.partOfSpeech,
        definition: candidate.definition,
        example: candidate.example,
        pronunciationText: candidate.pronunciationText,
        audioUrl: candidate.audioUrl,
        source: WordDataSource.DICTIONARY,
        rawJson: candidate.rawJson,
      },
      update: {
        word: cleanString(data.word) ?? input.word.trim(),
        definition: candidate.definition,
        example: candidate.example,
        pronunciationText: candidate.pronunciationText,
        audioUrl: candidate.audioUrl,
        source: WordDataSource.DICTIONARY,
        rawJson: candidate.rawJson,
      },
    });

    return {
      definition: candidate.definition,
      example: candidate.example,
      pronunciationText: candidate.pronunciationText,
      audioUrl: candidate.audioUrl,
      partOfSpeech: candidate.partOfSpeech,
      source: WordDataSource.DICTIONARY,
      status: DictionaryLookupStatus.FOUND,
      normalizedWord,
    };
  } catch (error) {
    console.warn("FreeDictionaryAPI lookup failed", {
      normalizedWord,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      ...emptyResult,
      source: WordDataSource.DICTIONARY,
      status: DictionaryLookupStatus.ERROR,
      error: "Dictionary service is temporarily unavailable.",
    };
  }
}
