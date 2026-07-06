-- Align deck word uniqueness with the teacher deck MVP rule:
-- one English term can appear only once inside a deck.
DROP INDEX "DeckWord_deckId_term_translation_key";

CREATE UNIQUE INDEX "DeckWord_deckId_term_key" ON "DeckWord"("deckId", "term");
