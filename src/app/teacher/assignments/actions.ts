"use server";

import { ActivityType, AssignmentStatus, Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_WORDS_PER_LESSON = 5;
const MAX_WORDS_PER_LESSON = 15;

type SyncAiSnapshotResult = {
  ok: boolean;
  templateUpdatedCount: number;
  classSnapshotUpdatedCount: number;
  templateWordsUpdated: number;
  classLessonWordsUpdated: number;
  skippedCount: number;
  noSourceAiCount: number;
  failedCount: number;
  error?: string;
};

const SYNC_UPDATE_BATCH_SIZE = 20;

function redirectWithError(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseWordsPerLesson(value: FormDataEntryValue | null) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < MIN_WORDS_PER_LESSON || parsed > MAX_WORDS_PER_LESSON) {
    return null;
  }

  return parsed;
}

async function requireOwnedTemplate(templateId: string) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const template = await prisma.assignmentTemplate.findFirst({
    where: {
      id: templateId,
      teacherId: teacher.id,
    },
    select: {
      id: true,
      teacherId: true,
      title: true,
    },
  });

  if (!template) {
    notFound();
  }

  return { teacher, template };
}

function splitIntoLessons<T>(items: T[], wordsPerLesson: number) {
  const chunks: T[][] = [];

  // TODO: improve balancing so tiny final lessons are merged more gracefully.
  for (let index = 0; index < items.length; index += wordsPerLesson) {
    chunks.push(items.slice(index, index + wordsPerLesson));
  }

  return chunks;
}

export async function createAssignmentTemplateAction(formData: FormData) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const path = "/teacher/assignments/new";
  const title = String(formData.get("title") ?? "").trim();
  const description = cleanOptional(formData.get("description"));
  const deckId = String(formData.get("deckId") ?? "").trim();
  const wordsPerLesson = parseWordsPerLesson(formData.get("wordsPerLesson"));

  if (!title) {
    redirectWithError(path, "Assignment title is required.");
  }

  if (!deckId) {
    redirectWithError(path, "Deck is required.");
  }

  if (!wordsPerLesson) {
    redirectWithError(path, "Words per lesson must be between 5 and 15.");
  }

  const deck = await prisma.deck.findFirst({
    where: {
      id: deckId,
      teacherId: teacher.id,
    },
    select: {
      id: true,
      words: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          term: true,
          translation: true,
          definition: true,
          example: true,
        },
      },
    },
  });

  if (!deck) {
    redirectWithError(path, "Selected deck was not found.");
  }

  if (deck.words.length === 0) {
    redirectWithError(path, "Selected deck must have at least one word.");
  }

  try {
    const template = await prisma.$transaction(async (tx) => {
      const createdTemplate = await tx.assignmentTemplate.create({
        data: {
          teacherId: teacher.id,
          sourceDeckId: deck.id,
          title,
          description,
          wordsPerLesson,
          status: AssignmentStatus.DRAFT,
        },
        select: { id: true },
      });
      const lessons = splitIntoLessons(deck.words, wordsPerLesson);

      for (const [lessonIndex, words] of lessons.entries()) {
        const lesson = await tx.templateLesson.create({
          data: {
            templateId: createdTemplate.id,
            title: `Lesson ${lessonIndex + 1}`,
            activity: ActivityType.STUDY_CARDS,
            sortOrder: lessonIndex,
          },
          select: { id: true },
        });

        await tx.templateLessonWord.createMany({
          data: words.map((word, wordIndex) => ({
            templateLessonId: lesson.id,
            deckWordId: word.id,
            term: word.term,
            translation: word.translation,
            definition: word.definition ?? "",
            example: word.example,
            sortOrder: wordIndex,
          })),
        });
      }

      return createdTemplate;
    });

    redirect(`/teacher/assignments/${template.id}`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithError(path, "You already have an assignment with this title.");
    }

    throw error;
  }
}

export async function assignTemplateToClassesAction(
  templateId: string,
  formData: FormData,
) {
  const { teacher } = await requireOwnedTemplate(templateId);
  const path = `/teacher/assignments/${templateId}`;
  const classIds = Array.from(
    new Set(
      formData
        .getAll("classIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );

  if (classIds.length === 0) {
    redirectWithError(path, "Select at least one class.");
  }

  const template = await prisma.assignmentTemplate.findFirst({
    where: {
      id: templateId,
      teacherId: teacher.id,
    },
    include: {
      lessons: {
        orderBy: { sortOrder: "asc" },
        include: {
          words: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!template) {
    notFound();
  }

  if (template.lessons.length === 0) {
    redirectWithError(path, "This assignment has no lessons to assign.");
  }

  const ownedClasses = await prisma.classRoom.findMany({
    where: {
      id: { in: classIds },
      teacherId: teacher.id,
      isActive: true,
    },
    select: { id: true },
  });
  const ownedClassIds = ownedClasses.map((classRoom) => classRoom.id);

  if (ownedClassIds.length === 0) {
    redirectWithError(path, "No valid active classes were selected.");
  }

  const existingAssignments = await prisma.classAssignment.findMany({
    where: {
      templateId,
      classId: { in: ownedClassIds },
      teacherId: teacher.id,
      status: { not: AssignmentStatus.ARCHIVED },
    },
    select: { classId: true },
  });
  const duplicateClassIds = new Set(
    existingAssignments.map((assignment) => assignment.classId),
  );
  const classIdsToAssign = ownedClassIds.filter(
    (classId) => !duplicateClassIds.has(classId),
  );

  if (classIdsToAssign.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const classId of classIdsToAssign) {
        const classAssignment = await tx.classAssignment.create({
          data: {
            classId,
            templateId: template.id,
            teacherId: teacher.id,
            title: template.title,
            status: AssignmentStatus.ASSIGNED,
          },
          select: { id: true },
        });

        for (const templateLesson of template.lessons) {
          const classLesson = await tx.classLesson.create({
            data: {
              classAssignmentId: classAssignment.id,
              templateLessonId: templateLesson.id,
              title: templateLesson.title,
              activity: templateLesson.activity,
              sortOrder: templateLesson.sortOrder,
            },
            select: { id: true },
          });

          await tx.classLessonWord.createMany({
            data: templateLesson.words.map((word) => ({
              classLessonId: classLesson.id,
              templateLessonWordId: word.id,
              deckWordId: word.deckWordId,
              term: word.term,
              translation: word.translation,
              definition: word.definition,
              example: word.example,
              sortOrder: word.sortOrder,
            })),
          });
        }
      }
    });
  }

  revalidatePath(path);
  revalidatePath("/teacher/assignments");
  revalidatePath("/teacher/classes");
  redirect(
    `${path}?assigned=${classIdsToAssign.length}&duplicates=${duplicateClassIds.size}`,
  );
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function wordKey(term: string, translation: string) {
  return `${term.trim().toLowerCase()}\u0000${translation.trim().toLowerCase()}`;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function syncAssignmentAiSnapshotsAction(input: {
  templateId: string;
  overwriteExisting?: boolean;
}): Promise<SyncAiSnapshotResult> {
  const { teacher } = await requireOwnedTemplate(input.templateId);
  const overwriteExisting = Boolean(input.overwriteExisting);
  const template = await prisma.assignmentTemplate.findFirst({
    where: {
      id: input.templateId,
      teacherId: teacher.id,
    },
    include: {
      lessons: {
        orderBy: { sortOrder: "asc" },
        include: {
          words: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!template) {
    notFound();
  }

  if (!template.sourceDeckId) {
    return {
      ok: false,
      templateUpdatedCount: 0,
      classSnapshotUpdatedCount: 0,
      templateWordsUpdated: 0,
      classLessonWordsUpdated: 0,
      skippedCount: 0,
      noSourceAiCount: 0,
      failedCount: 0,
      error: "This assignment does not have a source deck to sync from.",
    };
  }

  const sourceWords = await prisma.deckWord.findMany({
    where: {
      deckId: template.sourceDeckId,
      deck: {
        teacherId: teacher.id,
      },
    },
    select: {
      id: true,
      term: true,
      translation: true,
      definition: true,
      example: true,
    },
  });
  const sourceById = new Map(sourceWords.map((word) => [word.id, word]));
  const sourceByText = new Map(
    sourceWords.map((word) => [wordKey(word.term, word.translation), word]),
  );
  let templateWordsUpdated = 0;
  let classLessonWordsUpdated = 0;
  let skippedCount = 0;
  let noSourceAiCount = 0;
  let failedCount = 0;
  const desiredByTemplateWordId = new Map<
    string,
    { definition: string; example: string | null }
  >();
  const templateUpdates: Array<{
    id: string;
    definition: string;
    example: string | null;
  }> = [];

  for (const lesson of template.lessons) {
    for (const word of lesson.words) {
      const source =
        (word.deckWordId ? sourceById.get(word.deckWordId) : undefined) ??
        sourceByText.get(wordKey(word.term, word.translation));

      if (!source || (!hasText(source.definition) && !hasText(source.example))) {
        noSourceAiCount += 1;
        desiredByTemplateWordId.set(word.id, {
          definition: word.definition,
          example: word.example,
        });
        continue;
      }

      const nextDefinition =
        hasText(source.definition) &&
        (overwriteExisting || !hasText(word.definition))
          ? source.definition?.trim() ?? word.definition
          : word.definition;
      const nextExample =
        hasText(source.example) && (overwriteExisting || !hasText(word.example))
          ? source.example?.trim() ?? word.example
          : word.example;
      const templateChanged =
        nextDefinition !== word.definition || nextExample !== word.example;

      desiredByTemplateWordId.set(word.id, {
        definition: nextDefinition,
        example: nextExample,
      });

      if (templateChanged) {
        templateUpdates.push({
          id: word.id,
          definition: nextDefinition,
          example: nextExample,
        });
      } else {
        skippedCount += 1;
      }
    }
  }

  const templateWordIds = Array.from(desiredByTemplateWordId.keys());
  const classUpdates: Array<{
    id: string;
    definition: string;
    example: string | null;
  }> = [];

  if (templateWordIds.length > 0) {
    const classWords = await prisma.classLessonWord.findMany({
      where: {
        templateLessonWordId: { in: templateWordIds },
        classLesson: {
          assignment: {
            templateId: template.id,
            teacherId: teacher.id,
            status: { not: AssignmentStatus.ARCHIVED },
            classRoom: {
              teacherId: teacher.id,
            },
          },
        },
      },
      select: {
        id: true,
        templateLessonWordId: true,
        definition: true,
        example: true,
      },
    });

    for (const classWord of classWords) {
      if (!classWord.templateLessonWordId) {
        continue;
      }

      const desired = desiredByTemplateWordId.get(classWord.templateLessonWordId);

      if (!desired) {
        continue;
      }

      const nextDefinition =
        hasText(desired.definition) &&
        (overwriteExisting || !hasText(classWord.definition))
          ? desired.definition
          : classWord.definition;
      const nextExample =
        hasText(desired.example) && (overwriteExisting || !hasText(classWord.example))
          ? desired.example
          : classWord.example;

      if (
        nextDefinition !== classWord.definition ||
        nextExample !== classWord.example
      ) {
        classUpdates.push({
          id: classWord.id,
          definition: nextDefinition,
          example: nextExample,
        });
      }
    }
  }

  for (const batch of chunkArray(templateUpdates, SYNC_UPDATE_BATCH_SIZE)) {
    try {
      await prisma.$transaction(
        batch.map((update) =>
          prisma.templateLessonWord.update({
            where: { id: update.id },
            data: {
              definition: update.definition,
              example: update.example,
            },
          }),
        ),
      );
      templateWordsUpdated += batch.length;
    } catch (error) {
      console.error("Template AI snapshot sync batch failed", {
        templateId: template.id,
        batchSize: batch.length,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      failedCount += batch.length;
    }
  }

  for (const batch of chunkArray(classUpdates, SYNC_UPDATE_BATCH_SIZE)) {
    try {
      await prisma.$transaction(
        batch.map((update) =>
          prisma.classLessonWord.update({
            where: { id: update.id },
            data: {
              definition: update.definition,
              example: update.example,
            },
          }),
        ),
      );
      classLessonWordsUpdated += batch.length;
    } catch (error) {
      console.error("Class AI snapshot sync batch failed", {
        templateId: template.id,
        batchSize: batch.length,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      failedCount += batch.length;
    }
  }

  revalidatePath(`/teacher/assignments/${input.templateId}`);
  revalidatePath("/teacher/assignments");
  revalidatePath("/teacher/classes");

  return {
    ok: failedCount === 0,
    templateUpdatedCount: templateWordsUpdated,
    classSnapshotUpdatedCount: classLessonWordsUpdated,
    templateWordsUpdated,
    classLessonWordsUpdated,
    skippedCount,
    noSourceAiCount,
    failedCount,
    error:
      failedCount > 0
        ? "Some snapshot records could not be updated. Please try again."
        : undefined,
  };
}
