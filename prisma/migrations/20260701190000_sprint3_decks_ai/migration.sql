ALTER TABLE "DeckWord" ALTER COLUMN "definition" DROP NOT NULL;

ALTER TABLE "AiUsageLog" ADD COLUMN "promptType" TEXT;
ALTER TABLE "AiUsageLog" ADD COLUMN "success" BOOLEAN;
ALTER TABLE "AiUsageLog" ADD COLUMN "errorCode" TEXT;

CREATE INDEX "AiUsageLog_promptType_idx" ON "AiUsageLog"("promptType");
CREATE INDEX "AiUsageLog_success_idx" ON "AiUsageLog"("success");
