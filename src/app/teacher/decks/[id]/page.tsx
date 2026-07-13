import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { DeckDetailClient } from "../deck-detail-client";

type DeckDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    imported?: string;
    skipped?: string;
    duplicate?: string;
  }>;
};

export default async function DeckDetailPage({
  params,
  searchParams,
}: DeckDetailPageProps) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");
  const { id } = await params;
  const query = await searchParams;
  const deck = await prisma.deck.findFirst({
    where: {
      id,
      teacherId: teacher.id,
    },
    include: {
      words: {
        orderBy: [
          { createdAt: "desc" },
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        select: {
          id: true,
          term: true,
          translation: true,
          definition: true,
          example: true,
          pronunciationText: true,
          audioUrl: true,
          partOfSpeech: true,
          dataSource: true,
          lookupStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: { words: true },
      },
    },
  });

  if (!deck) {
    notFound();
  }

  const importResult =
    query?.imported || query?.skipped || query?.duplicate
      ? {
          imported: Number(query.imported ?? 0),
          skipped: Number(query.skipped ?? 0),
          duplicate: Number(query.duplicate ?? 0),
        }
      : null;

  return (
    <DeckDetailClient
      deck={{
        id: deck.id,
        title: deck.title,
        description: deck.description,
        createdAt: deck.createdAt.toISOString(),
        updatedAt: deck.updatedAt.toISOString(),
        wordsCount: deck._count.words,
        words: deck.words.map((word) => ({
          id: word.id,
          english: word.term,
          translation: word.translation,
          definition: word.definition,
          example: word.example,
          pronunciationText: word.pronunciationText ?? null,
          audioUrl: word.audioUrl ?? null,
          partOfSpeech: word.partOfSpeech ?? "AUTO",
          dataSource: word.dataSource ?? "MANUAL",
          lookupStatus: word.lookupStatus,
          createdAt: word.createdAt.toISOString(),
          updatedAt: word.updatedAt.toISOString(),
        })),
      }}
      error={query?.error}
      importResult={importResult}
    />
  );
}
