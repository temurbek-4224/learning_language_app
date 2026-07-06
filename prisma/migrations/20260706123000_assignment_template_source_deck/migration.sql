ALTER TABLE "AssignmentTemplate" ADD COLUMN "sourceDeckId" TEXT;
ALTER TABLE "AssignmentTemplate" ADD COLUMN "wordsPerLesson" INTEGER NOT NULL DEFAULT 10;

CREATE INDEX "AssignmentTemplate_sourceDeckId_idx" ON "AssignmentTemplate"("sourceDeckId");

ALTER TABLE "AssignmentTemplate" ADD CONSTRAINT "AssignmentTemplate_sourceDeckId_fkey" FOREIGN KEY ("sourceDeckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
