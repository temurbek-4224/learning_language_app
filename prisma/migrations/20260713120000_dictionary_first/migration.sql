CREATE TYPE "WordPartOfSpeech" AS ENUM ('AUTO', 'NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'OTHER');
CREATE TYPE "WordDataSource" AS ENUM ('DICTIONARY', 'CACHE', 'GEMINI', 'MANUAL');
CREATE TYPE "DictionaryLookupStatus" AS ENUM ('FOUND', 'NOT_FOUND', 'NEEDS_REVIEW', 'ERROR');

ALTER TABLE "DeckWord"
ADD COLUMN "pronunciationText" TEXT,
ADD COLUMN "audioUrl" TEXT,
ADD COLUMN "partOfSpeech" "WordPartOfSpeech" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "dataSource" "WordDataSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "lookupStatus" "DictionaryLookupStatus";

CREATE TABLE "DictionaryEntryCache" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "normalizedWord" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "partOfSpeech" "WordPartOfSpeech" NOT NULL,
    "definition" TEXT,
    "example" TEXT,
    "pronunciationText" TEXT,
    "audioUrl" TEXT,
    "source" "WordDataSource" NOT NULL DEFAULT 'DICTIONARY',
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictionaryEntryCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DictionaryEntryCache_normalizedWord_language_partOfSpeech_key"
ON "DictionaryEntryCache"("normalizedWord", "language", "partOfSpeech");
CREATE INDEX "DictionaryEntryCache_normalizedWord_language_idx"
ON "DictionaryEntryCache"("normalizedWord", "language");
