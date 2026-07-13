import {
  DictionaryLookupStatus,
  Prisma,
  WordDataSource,
  WordPartOfSpeech,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DICTIONARY_API_BASE = "https://api.dictionaryapi.dev/api/v2";
const FREE_DICTIONARY_API_BASE = "https://freedictionaryapi.com/api/v1";
const DICTIONARY_TIMEOUT_MS = 8_000;
const MAX_CANDIDATES = 24;

const TECHNICAL_MARKERS = [
  "computing",
  "computer",
  "programming",
  "software",
  "hardware",
  "networking",
  "internet",
  "mathematics",
  "chemistry",
  "physics",
  "biology",
  "engineering",
  "technical",
];

const UNCOMMON_MARKERS = [
  "archaic",
  "obsolete",
  "dated",
  "rare",
  "historical",
  "humorous",
  "slang",
  "figurative",
  "mormonism",
];

const PROFESSION_WORDS = new Set([
  "worker",
  "teacher",
  "doctor",
  "nurse",
  "driver",
  "farmer",
  "engineer",
  "lawyer",
  "artist",
  "dentist",
  "scientist",
  "student",
  "manager",
  "waiter",
  "waitress",
  "police officer",
]);

const PROFESSION_HINTS: Record<string, string[]> = {
  worker: ["works", "labor", "living", "employee"],
  teacher: ["teaches", "school", "educat"],
  doctor: ["physician", "medical profession", "heal the sick"],
  nurse: ["patient", "healthcare", "medical"],
  driver: ["drives", "vehicle"],
  farmer: ["farm", "crop", "livestock"],
};

type ApiPronunciation = {
  text?: unknown;
  audio?: unknown;
};

type ApiDefinition = {
  definition?: unknown;
  example?: unknown;
};

type ApiMeaning = {
  partOfSpeech?: unknown;
  definitions?: unknown;
};

type ApiEntry = {
  word?: unknown;
  phonetic?: unknown;
  phonetics?: unknown;
  meanings?: unknown;
};

type ApiResponse = ApiEntry[];

type FreePronunciation = {
  type?: unknown;
  text?: unknown;
};

type FreeSense = {
  definition?: unknown;
  examples?: unknown;
  tags?: unknown;
  subsenses?: unknown;
};

type FreeEntry = {
  language?: { code?: unknown };
  partOfSpeech?: unknown;
  pronunciations?: unknown;
  senses?: unknown;
};

type FreeApiResponse = {
  word?: unknown;
  entries?: unknown;
};

type DictionaryProvider = "dictionaryapi.dev" | "freedictionaryapi.com";

export type DictionaryCandidate = {
  id: string;
  definition: string;
  example: string | null;
  pronunciationText: string | null;
  audioUrl: string | null;
  partOfSpeech: WordPartOfSpeech;
  tags: string[];
};

export type DictionaryCandidatesResult = {
  candidates: DictionaryCandidate[];
  source: typeof WordDataSource.DICTIONARY | typeof WordDataSource.CACHE;
  status: DictionaryLookupStatus;
  normalizedWord: string;
  error?: string;
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

export function normalizeDictionaryWord(word: string) {
  return word.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(cleanString).filter((item): item is string => Boolean(item))
    : [];
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

function normalizeAudioUrl(value: unknown) {
  const audioUrl = cleanString(value);
  if (!audioUrl) {
    return null;
  }
  return audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
}

function audioDialectPriority(audioUrl: string) {
  const normalized = audioUrl.toLowerCase();
  if (/(?:^|[-_/])(us|american)(?:[-_.?/]|$)/.test(normalized)) {
    return 0;
  }
  if (/(?:^|[-_/])(uk|gb|british)(?:[-_.?/]|$)/.test(normalized)) {
    return 1;
  }
  return 2;
}

function getDictionaryApiPronunciation(entry: ApiEntry) {
  const phonetics = Array.isArray(entry.phonetics)
    ? (entry.phonetics as ApiPronunciation[])
    : [];
  const preferredAudio = phonetics
    .map((item, index) => ({
      item,
      index,
      audioUrl: normalizeAudioUrl(item.audio),
    }))
    .filter(
      (candidate): candidate is typeof candidate & { audioUrl: string } =>
        Boolean(candidate.audioUrl),
    )
    .sort(
      (left, right) =>
        audioDialectPriority(left.audioUrl) -
          audioDialectPriority(right.audioUrl) || left.index - right.index,
    )[0];
  const pronunciationText =
    cleanString(preferredAudio?.item.text) ??
    phonetics.map((item) => cleanString(item.text)).find(Boolean) ??
    cleanString(entry.phonetic);

  return {
    pronunciationText: pronunciationText ?? null,
    audioUrl: preferredAudio?.audioUrl ?? null,
  };
}

function getDomainTags(definition: string) {
  const match = definition.match(/^\(([^)]+)\)/);
  return match
    ? match[1]
        .split(/[,;]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
}

function buildDictionaryApiCandidates(response: ApiResponse) {
  if (!Array.isArray(response)) {
    return [];
  }

  const candidates: DictionaryCandidate[] = [];
  let candidateIndex = 0;

  for (const value of response) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const entry = value as ApiEntry;
    const pronunciation = getDictionaryApiPronunciation(entry);

    const meanings = Array.isArray(entry.meanings)
      ? (entry.meanings as ApiMeaning[])
      : [];

    for (const meaning of meanings) {
      const partOfSpeech = mapPartOfSpeech(meaning.partOfSpeech);
      const definitions = Array.isArray(meaning.definitions)
        ? (meaning.definitions as ApiDefinition[])
        : [];

      for (const apiDefinition of definitions) {
        const definition = cleanString(apiDefinition.definition);
        if (!definition) {
          continue;
        }

        const duplicate = candidates.find(
          (candidate) =>
            candidate.partOfSpeech === partOfSpeech &&
            candidate.definition.toLowerCase() === definition.toLowerCase(),
        );
        if (duplicate) {
          if (!duplicate.audioUrl && pronunciation.audioUrl) {
            duplicate.audioUrl = pronunciation.audioUrl;
          }
          if (!duplicate.pronunciationText && pronunciation.pronunciationText) {
            duplicate.pronunciationText = pronunciation.pronunciationText;
          }
          continue;
        }

        candidates.push({
          id: `${partOfSpeech.toLowerCase()}-${candidateIndex}`,
          definition,
          example: cleanString(apiDefinition.example),
          ...pronunciation,
          partOfSpeech,
          tags: getDomainTags(definition),
        });
        candidateIndex += 1;
      }
    }
  }

  return candidates;
}

function flattenFreeSenses(value: unknown): FreeSense[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const sense = item as FreeSense;
    return [sense, ...flattenFreeSenses(sense.subsenses)];
  });
}

function getFreePronunciation(entry: FreeEntry) {
  const pronunciations = Array.isArray(entry.pronunciations)
    ? (entry.pronunciations as FreePronunciation[])
    : [];
  const ipa = pronunciations.find(
    (item) => cleanString(item.type)?.toLowerCase() === "ipa" && cleanString(item.text),
  );

  return cleanString(ipa?.text) ??
    pronunciations.map((item) => cleanString(item.text)).find(Boolean) ??
    null;
}

function buildFreeDictionaryCandidates(
  response: FreeApiResponse,
  normalizedWord: string,
  primaryPronunciation?: {
    pronunciationText: string | null;
    audioUrl: string | null;
  },
) {
  const entries = Array.isArray(response.entries)
    ? (response.entries as FreeEntry[])
    : [];
  const candidates: DictionaryCandidate[] = [];
  let candidateIndex = 0;

  for (const entry of entries) {
    if (cleanString(entry.language?.code)?.toLowerCase() !== "en") {
      continue;
    }

    const partOfSpeech = mapPartOfSpeech(entry.partOfSpeech);
    const pronunciationText =
      primaryPronunciation?.pronunciationText ?? getFreePronunciation(entry);

    for (const sense of flattenFreeSenses(entry.senses)) {
      const definition = cleanString(sense.definition);
      if (!definition) {
        continue;
      }

      const examples = cleanStringArray(sense.examples);
      const example =
        examples.find((value) => escapedWordPattern(normalizedWord).test(value)) ??
        examples[0] ??
        null;
      const tags = [
        ...new Set([...cleanStringArray(sense.tags), ...getDomainTags(definition)]),
      ];
      const duplicate = candidates.find(
        (candidate) =>
          candidate.partOfSpeech === partOfSpeech &&
          candidate.definition.toLowerCase() === definition.toLowerCase(),
      );

      if (duplicate) {
        if (!duplicate.example && example) {
          duplicate.example = example;
        }
        continue;
      }

      candidates.push({
        id: `free-${partOfSpeech.toLowerCase()}-${candidateIndex}`,
        definition,
        example,
        pronunciationText,
        // FreeDictionaryAPI pronunciation data is text-only. Audio stays primary-only.
        audioUrl: primaryPronunciation?.audioUrl ?? null,
        partOfSpeech,
        tags,
      });
      candidateIndex += 1;
    }
  }

  return candidates;
}

function isLikelyProfessionWord(word: string) {
  return (
    PROFESSION_WORDS.has(word) ||
    /(?:er|or|ist|ian)$/.test(word)
  );
}

function scoreCandidate(
  candidate: DictionaryCandidate,
  normalizedWord: string,
  requestedPartOfSpeech: WordPartOfSpeech,
) {
  const searchable = `${candidate.tags.join(" ")} ${candidate.definition}`.toLowerCase();
  const personMeaning =
    /\b(?:a person who|one who|a person that|someone who)\b/i.test(
      candidate.definition,
    );
  let score = 1_000;

  if (requestedPartOfSpeech !== WordPartOfSpeech.AUTO) {
    score +=
      candidate.partOfSpeech === requestedPartOfSpeech ? 1_200 : -500;
  }
  if (candidate.example) {
    score += 180;
    if (escapedWordPattern(normalizedWord).test(candidate.example)) {
      score += 260;
    }
  }
  if (candidate.definition.length >= 18 && candidate.definition.length <= 160) {
    score += 120;
  }
  if (candidate.definition.split(/\s+/).length <= 22) {
    score += 70;
  }
  if (isLikelyProfessionWord(normalizedWord)) {
    if (candidate.partOfSpeech === WordPartOfSpeech.NOUN) {
      score += 220;
    }
    if (personMeaning) {
      score += 850;
    }
    if (
      PROFESSION_HINTS[normalizedWord]?.some((hint) => searchable.includes(hint))
    ) {
      score += 900;
    }
  } else if (personMeaning) {
    score += 120;
  }

  for (const marker of TECHNICAL_MARKERS) {
    if (searchable.includes(marker)) {
      score -= 650;
    }
  }
  for (const marker of UNCOMMON_MARKERS) {
    if (searchable.includes(marker)) {
      score -= 350;
    }
  }

  score -= Math.min(candidate.definition.length, 600) / 12;
  return score;
}

function rankCandidates(
  candidates: DictionaryCandidate[],
  normalizedWord: string,
  requestedPartOfSpeech: WordPartOfSpeech,
) {
  return [...candidates]
    .sort(
      (left, right) =>
        scoreCandidate(right, normalizedWord, requestedPartOfSpeech) -
        scoreCandidate(left, normalizedWord, requestedPartOfSpeech),
    )
    .slice(0, MAX_CANDIDATES);
}

function isDictionaryCandidate(value: unknown): value is DictionaryCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<DictionaryCandidate>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.definition === "string" &&
    Object.values(WordPartOfSpeech).includes(
      candidate.partOfSpeech as WordPartOfSpeech,
    ) &&
    Array.isArray(candidate.tags)
  );
}

function parseCachedCandidates(rawJson: Prisma.JsonValue | null) {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    return [];
  }
  const value = rawJson as {
    version?: unknown;
    provider?: unknown;
    candidates?: unknown;
  };
  const supportedProvider =
    value.provider === "dictionaryapi.dev" ||
    value.provider === "freedictionaryapi.com";
  const supportedVersion =
    value.version === 4 ||
    (value.version === 3 && value.provider === "dictionaryapi.dev");

  return supportedVersion && supportedProvider &&
    Array.isArray(value.candidates)
    ? value.candidates.filter(isDictionaryCandidate)
    : [];
}

async function cacheCandidates(input: {
  word: string;
  normalizedWord: string;
  candidates: DictionaryCandidate[];
  selected: DictionaryCandidate;
  provider: DictionaryProvider;
}) {
  const rawJson = JSON.parse(
    JSON.stringify({
      version: 4,
      provider: input.provider,
      candidates: input.candidates,
    }),
  ) as Prisma.InputJsonValue;

  await prisma.$transaction(async (tx) => {
    await tx.dictionaryEntryCache.deleteMany({
      where: { normalizedWord: input.normalizedWord, language: "en" },
    });
    await tx.dictionaryEntryCache.create({
      data: {
        word: input.word,
        normalizedWord: input.normalizedWord,
        language: "en",
        partOfSpeech: input.selected.partOfSpeech,
        definition: input.selected.definition,
        example: input.selected.example,
        pronunciationText: input.selected.pronunciationText,
        audioUrl: input.selected.audioUrl,
        source: WordDataSource.DICTIONARY,
        rawJson,
      },
    });
  });
}

async function saveCandidatesToCache(
  input: Parameters<typeof cacheCandidates>[0],
) {
  try {
    await cacheCandidates(input);
  } catch (error) {
    console.warn("Dictionary cache write failed", {
      normalizedWord: input.normalizedWord,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestDictionaryUrl(url: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(DICTIONARY_TIMEOUT_MS),
    });

    if (response.status !== 429) {
      return response;
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
    if (attempt === 0 && retryAfterSeconds > 0 && retryAfterSeconds <= 2) {
      await wait(retryAfterSeconds * 1_000);
      continue;
    }

    return response;
  }

  throw new Error("Dictionary request retry exhausted.");
}

function requestDictionaryApi(normalizedWord: string) {
  return requestDictionaryUrl(
    `${DICTIONARY_API_BASE}/entries/en/${encodeURIComponent(normalizedWord)}`,
  );
}

function requestFreeDictionaryApi(normalizedWord: string) {
  return requestDictionaryUrl(
    `${FREE_DICTIONARY_API_BASE}/entries/en/${encodeURIComponent(normalizedWord)}`,
  );
}

export async function getDictionaryCandidates(input: {
  word: string;
  partOfSpeech?: WordPartOfSpeech;
  bypassCache?: boolean;
}): Promise<DictionaryCandidatesResult> {
  const normalizedWord = normalizeDictionaryWord(input.word);
  const requestedPartOfSpeech = input.partOfSpeech ?? WordPartOfSpeech.AUTO;

  if (!normalizedWord) {
    return {
      candidates: [],
      source: WordDataSource.DICTIONARY,
      status: DictionaryLookupStatus.NEEDS_REVIEW,
      normalizedWord,
    };
  }

  if (!input.bypassCache) {
    const cachedEntries = await prisma.dictionaryEntryCache.findMany({
      where: { normalizedWord, language: "en", definition: { not: null } },
      orderBy: { updatedAt: "desc" },
    });
    const cachedCandidates = cachedEntries.flatMap((entry) =>
      parseCachedCandidates(entry.rawJson),
    );

    if (cachedCandidates.length > 0) {
      return {
        candidates: rankCandidates(
          cachedCandidates,
          normalizedWord,
          requestedPartOfSpeech,
        ),
        source: WordDataSource.CACHE,
        status: DictionaryLookupStatus.FOUND,
        normalizedWord,
      };
    }
  }

  let primaryPronunciation:
    | ReturnType<typeof getDictionaryApiPronunciation>
    | undefined;

  try {
    const response = await requestDictionaryApi(normalizedWord);

    if (response.ok) {
      const data = (await response.json()) as ApiResponse;
      if (Array.isArray(data)) {
        primaryPronunciation = data
          .map(getDictionaryApiPronunciation)
          .find((item) => item.pronunciationText || item.audioUrl);
      }
      const candidates = rankCandidates(
        buildDictionaryApiCandidates(data),
        normalizedWord,
        requestedPartOfSpeech,
      );
      const selected = candidates[0];

      if (selected) {
        await saveCandidatesToCache({
          word: cleanString(data[0]?.word) ?? input.word.trim(),
          normalizedWord,
          candidates,
          selected,
          provider: "dictionaryapi.dev",
        });

        return {
          candidates,
          source: WordDataSource.DICTIONARY,
          status: DictionaryLookupStatus.FOUND,
          normalizedWord,
        };
      }
    } else if (response.status !== 404) {
      console.warn("dictionaryapi.dev returned a technical error", {
        normalizedWord,
        status: response.status,
      });
    }
  } catch (error) {
    console.warn("dictionaryapi.dev lookup failed; trying fallback", {
      normalizedWord,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const response = await requestFreeDictionaryApi(normalizedWord);

    if (response.status === 404) {
      return {
        candidates: [],
        source: WordDataSource.DICTIONARY,
        status: DictionaryLookupStatus.NEEDS_REVIEW,
        normalizedWord,
      };
    }

    if (!response.ok) {
      return {
        candidates: [],
        source: WordDataSource.DICTIONARY,
        status: DictionaryLookupStatus.ERROR,
        normalizedWord,
        error:
          response.status === 429
            ? "Dictionary services are rate limited (HTTP 429)."
            : `Dictionary fallback returned HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as FreeApiResponse;
    const candidates = rankCandidates(
      buildFreeDictionaryCandidates(data, normalizedWord, primaryPronunciation),
      normalizedWord,
      requestedPartOfSpeech,
    );
    const selected = candidates[0];

    if (!selected) {
      return {
        candidates: [],
        source: WordDataSource.DICTIONARY,
        status: DictionaryLookupStatus.NEEDS_REVIEW,
        normalizedWord,
      };
    }

    await saveCandidatesToCache({
      word: cleanString(data.word) ?? input.word.trim(),
      normalizedWord,
      candidates,
      selected,
      provider: "freedictionaryapi.com",
    });

    return {
      candidates,
      source: WordDataSource.DICTIONARY,
      status: DictionaryLookupStatus.FOUND,
      normalizedWord,
    };
  } catch (error) {
    console.warn("FreeDictionaryAPI fallback failed", {
      normalizedWord,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      candidates: [],
      source: WordDataSource.DICTIONARY,
      status: DictionaryLookupStatus.ERROR,
      normalizedWord,
      error: "Dictionary services are temporarily unavailable.",
    };
  }
}

export async function lookupDictionary(input: {
  word: string;
  partOfSpeech?: WordPartOfSpeech;
  bypassCache?: boolean;
}): Promise<DictionaryLookupResult> {
  const result = await getDictionaryCandidates(input);
  const selected = result.candidates[0];

  if (!selected) {
    return {
      definition: null,
      example: null,
      pronunciationText: null,
      audioUrl: null,
      partOfSpeech: input.partOfSpeech ?? WordPartOfSpeech.AUTO,
      source: result.source,
      status: result.status,
      normalizedWord: result.normalizedWord,
      error: result.error,
    };
  }

  return {
    definition: selected.definition,
    example: selected.example,
    pronunciationText: selected.pronunciationText,
    audioUrl: selected.audioUrl,
    partOfSpeech: selected.partOfSpeech,
    source: result.source,
    status: selected.example
      ? DictionaryLookupStatus.FOUND
      : DictionaryLookupStatus.NEEDS_REVIEW,
    normalizedWord: result.normalizedWord,
  };
}
