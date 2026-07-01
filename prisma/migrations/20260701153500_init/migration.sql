-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('STUDY_CARDS', 'TRANSLATION_QUIZ', 'DEFINITION_TYPING');

-- CreateTable
CREATE TABLE "WebUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "WebUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRoom" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMember" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckWord" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeckWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentTemplate" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateLesson" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "activity" "ActivityType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateLessonWord" (
    "id" TEXT NOT NULL,
    "templateLessonId" TEXT NOT NULL,
    "deckWordId" TEXT,
    "term" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateLessonWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssignment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassLesson" (
    "id" TEXT NOT NULL,
    "classAssignmentId" TEXT NOT NULL,
    "templateLessonId" TEXT,
    "title" TEXT NOT NULL,
    "activity" "ActivityType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassLessonWord" (
    "id" TEXT NOT NULL,
    "classLessonId" TEXT NOT NULL,
    "templateLessonWordId" TEXT,
    "deckWordId" TEXT,
    "term" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassLessonWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLessonProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classLessonId" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "score" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAnswerLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "classLessonWordId" TEXT,
    "activity" "ActivityType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedAnswer" TEXT NOT NULL,
    "submittedAnswer" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAnswerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "provider" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "costCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "classId" TEXT,
    "assignmentId" TEXT,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebUser_email_key" ON "WebUser"("email");

-- CreateIndex
CREATE INDEX "WebUser_role_idx" ON "WebUser"("role");

-- CreateIndex
CREATE INDEX "WebUser_status_idx" ON "WebUser"("status");

-- CreateIndex
CREATE INDEX "WebUser_createdById_idx" ON "WebUser"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Student_telegramUserId_key" ON "Student"("telegramUserId");

-- CreateIndex
CREATE INDEX "Student_telegramUserId_idx" ON "Student"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoom_inviteCode_key" ON "ClassRoom"("inviteCode");

-- CreateIndex
CREATE INDEX "ClassRoom_teacherId_idx" ON "ClassRoom"("teacherId");

-- CreateIndex
CREATE INDEX "ClassRoom_inviteCode_idx" ON "ClassRoom"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoom_teacherId_name_key" ON "ClassRoom"("teacherId", "name");

-- CreateIndex
CREATE INDEX "ClassMember_classId_idx" ON "ClassMember"("classId");

-- CreateIndex
CREATE INDEX "ClassMember_studentId_idx" ON "ClassMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassMember_classId_studentId_key" ON "ClassMember"("classId", "studentId");

-- CreateIndex
CREATE INDEX "Deck_teacherId_idx" ON "Deck"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Deck_teacherId_title_key" ON "Deck"("teacherId", "title");

-- CreateIndex
CREATE INDEX "DeckWord_deckId_idx" ON "DeckWord"("deckId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckWord_deckId_term_translation_key" ON "DeckWord"("deckId", "term", "translation");

-- CreateIndex
CREATE INDEX "AssignmentTemplate_teacherId_idx" ON "AssignmentTemplate"("teacherId");

-- CreateIndex
CREATE INDEX "AssignmentTemplate_status_idx" ON "AssignmentTemplate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentTemplate_teacherId_title_key" ON "AssignmentTemplate"("teacherId", "title");

-- CreateIndex
CREATE INDEX "TemplateLesson_templateId_idx" ON "TemplateLesson"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateLesson_templateId_sortOrder_key" ON "TemplateLesson"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "TemplateLessonWord_templateLessonId_idx" ON "TemplateLessonWord"("templateLessonId");

-- CreateIndex
CREATE INDEX "TemplateLessonWord_deckWordId_idx" ON "TemplateLessonWord"("deckWordId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateLessonWord_templateLessonId_sortOrder_key" ON "TemplateLessonWord"("templateLessonId", "sortOrder");

-- CreateIndex
CREATE INDEX "ClassAssignment_classId_idx" ON "ClassAssignment"("classId");

-- CreateIndex
CREATE INDEX "ClassAssignment_templateId_idx" ON "ClassAssignment"("templateId");

-- CreateIndex
CREATE INDEX "ClassAssignment_teacherId_idx" ON "ClassAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "ClassAssignment_status_idx" ON "ClassAssignment"("status");

-- CreateIndex
CREATE INDEX "ClassLesson_classAssignmentId_idx" ON "ClassLesson"("classAssignmentId");

-- CreateIndex
CREATE INDEX "ClassLesson_templateLessonId_idx" ON "ClassLesson"("templateLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLesson_classAssignmentId_sortOrder_key" ON "ClassLesson"("classAssignmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "ClassLessonWord_classLessonId_idx" ON "ClassLessonWord"("classLessonId");

-- CreateIndex
CREATE INDEX "ClassLessonWord_templateLessonWordId_idx" ON "ClassLessonWord"("templateLessonWordId");

-- CreateIndex
CREATE INDEX "ClassLessonWord_deckWordId_idx" ON "ClassLessonWord"("deckWordId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLessonWord_classLessonId_sortOrder_key" ON "ClassLessonWord"("classLessonId", "sortOrder");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_studentId_idx" ON "StudentLessonProgress"("studentId");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_classLessonId_idx" ON "StudentLessonProgress"("classLessonId");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_status_idx" ON "StudentLessonProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLessonProgress_studentId_classLessonId_key" ON "StudentLessonProgress"("studentId", "classLessonId");

-- CreateIndex
CREATE INDEX "StudentAnswerLog_studentId_idx" ON "StudentAnswerLog"("studentId");

-- CreateIndex
CREATE INDEX "StudentAnswerLog_progressId_idx" ON "StudentAnswerLog"("progressId");

-- CreateIndex
CREATE INDEX "StudentAnswerLog_classLessonWordId_idx" ON "StudentAnswerLog"("classLessonWordId");

-- CreateIndex
CREATE INDEX "StudentAnswerLog_activity_idx" ON "StudentAnswerLog"("activity");

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_idx" ON "AiUsageLog"("userId");

-- CreateIndex
CREATE INDEX "AiUsageLog_studentId_idx" ON "AiUsageLog"("studentId");

-- CreateIndex
CREATE INDEX "AiUsageLog_feature_idx" ON "AiUsageLog"("feature");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_studentId_idx" ON "NotificationLog"("studentId");

-- CreateIndex
CREATE INDEX "NotificationLog_classId_idx" ON "NotificationLog"("classId");

-- CreateIndex
CREATE INDEX "NotificationLog_assignmentId_idx" ON "NotificationLog"("assignmentId");

-- CreateIndex
CREATE INDEX "NotificationLog_event_idx" ON "NotificationLog"("event");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- AddForeignKey
ALTER TABLE "WebUser" ADD CONSTRAINT "WebUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "WebUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoom" ADD CONSTRAINT "ClassRoom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "WebUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "WebUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckWord" ADD CONSTRAINT "DeckWord_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTemplate" ADD CONSTRAINT "AssignmentTemplate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "WebUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateLesson" ADD CONSTRAINT "TemplateLesson_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssignmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateLessonWord" ADD CONSTRAINT "TemplateLessonWord_templateLessonId_fkey" FOREIGN KEY ("templateLessonId") REFERENCES "TemplateLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateLessonWord" ADD CONSTRAINT "TemplateLessonWord_deckWordId_fkey" FOREIGN KEY ("deckWordId") REFERENCES "DeckWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssignmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "WebUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLesson" ADD CONSTRAINT "ClassLesson_classAssignmentId_fkey" FOREIGN KEY ("classAssignmentId") REFERENCES "ClassAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLesson" ADD CONSTRAINT "ClassLesson_templateLessonId_fkey" FOREIGN KEY ("templateLessonId") REFERENCES "TemplateLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLessonWord" ADD CONSTRAINT "ClassLessonWord_classLessonId_fkey" FOREIGN KEY ("classLessonId") REFERENCES "ClassLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLessonWord" ADD CONSTRAINT "ClassLessonWord_templateLessonWordId_fkey" FOREIGN KEY ("templateLessonWordId") REFERENCES "TemplateLessonWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLessonWord" ADD CONSTRAINT "ClassLessonWord_deckWordId_fkey" FOREIGN KEY ("deckWordId") REFERENCES "DeckWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_classLessonId_fkey" FOREIGN KEY ("classLessonId") REFERENCES "ClassLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAnswerLog" ADD CONSTRAINT "StudentAnswerLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAnswerLog" ADD CONSTRAINT "StudentAnswerLog_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "StudentLessonProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAnswerLog" ADD CONSTRAINT "StudentAnswerLog_classLessonWordId_fkey" FOREIGN KEY ("classLessonWordId") REFERENCES "ClassLessonWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "WebUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "WebUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ClassAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

