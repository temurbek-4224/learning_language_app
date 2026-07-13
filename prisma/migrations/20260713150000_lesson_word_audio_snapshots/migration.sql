ALTER TABLE "TemplateLessonWord"
ADD COLUMN "audioUrl" TEXT;

ALTER TABLE "ClassLessonWord"
ADD COLUMN "audioUrl" TEXT;

UPDATE "TemplateLessonWord" AS template_word
SET "audioUrl" = deck_word."audioUrl"
FROM "DeckWord" AS deck_word
WHERE template_word."deckWordId" = deck_word."id"
  AND template_word."audioUrl" IS NULL;

UPDATE "ClassLessonWord" AS class_word
SET "audioUrl" = template_word."audioUrl"
FROM "TemplateLessonWord" AS template_word
WHERE class_word."templateLessonWordId" = template_word."id"
  AND class_word."audioUrl" IS NULL;

UPDATE "ClassLessonWord" AS class_word
SET "audioUrl" = deck_word."audioUrl"
FROM "DeckWord" AS deck_word
WHERE class_word."deckWordId" = deck_word."id"
  AND class_word."audioUrl" IS NULL;
