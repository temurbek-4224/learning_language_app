"use server";

import { randomBytes } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function redirectWithError(error: string) {
  redirect(`/teacher/classes?error=${encodeURIComponent(error)}`);
}

async function generateInviteCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = randomBytes(6).toString("base64url").toLowerCase();
    const existing = await prisma.classRoom.findUnique({
      where: { inviteCode },
      select: { id: true },
    });

    if (!existing) {
      return inviteCode;
    }
  }

  throw new Error("Could not generate a unique invite code.");
}

export async function createClassAction(formData: FormData) {
  const teacher = await requireRole(UserRole.TEACHER, "/teacher/login");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) {
    redirectWithError("Class title is required.");
  }

  const inviteCode = await generateInviteCode();

  try {
    await prisma.classRoom.create({
      data: {
        teacherId: teacher.id,
        title,
        description: description || null,
        inviteCode,
        isActive: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithError("You already have a class with this title.");
    }

    throw error;
  }

  redirect("/teacher/classes");
}
