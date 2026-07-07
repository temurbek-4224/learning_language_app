import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { TelegramAuthUser } from "@/lib/telegram";

const STUDENT_SESSION_COOKIE = "wordxotira_student";

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to at least 16 characters.");
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function createStudentSessionToken(studentId: string) {
  return `${studentId}.${sign(studentId)}`;
}

function verifyStudentSessionToken(token: string) {
  const [studentId, signature] = token.split(".");

  if (!studentId || !signature) {
    return null;
  }

  const expected = sign(studentId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  return studentId;
}

export async function upsertTelegramStudent(user: TelegramAuthUser) {
  return prisma.student.upsert({
    where: { telegramUserId: user.id },
    create: {
      telegramUserId: user.id,
      username: user.username ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      languageCode: user.languageCode ?? null,
      lastActiveAt: new Date(),
    },
    update: {
      username: user.username ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      languageCode: user.languageCode ?? null,
      lastActiveAt: new Date(),
    },
  });
}

export async function setStudentSession(studentId: string) {
  const cookieStore = await cookies();

  cookieStore.set(
    STUDENT_SESSION_COOKIE,
    createStudentSessionToken(studentId),
    {
      httpOnly: true,
      sameSite: "none",
      secure: process.env.NODE_ENV === "production",
      path: "/app",
      maxAge: 60 * 60 * 24 * 30,
    },
  );
}

async function getDevStudent() {
  if (process.env.NODE_ENV === "production" || !process.env.DEV_TELEGRAM_ID) {
    return null;
  }

  return upsertTelegramStudent({
    id: process.env.DEV_TELEGRAM_ID,
    username: process.env.DEV_USERNAME ?? null,
    firstName: process.env.DEV_FIRST_NAME ?? "Dev",
    lastName: process.env.DEV_LAST_NAME ?? "Student",
    languageCode: null,
  });
}

export async function getCurrentStudent() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;

  if (token) {
    const studentId = verifyStudentSessionToken(token);

    if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
      });

      if (student) {
        return student;
      }
    }
  }

  return getDevStudent();
}

export async function requireStudent() {
  const student = await getCurrentStudent();

  if (!student) {
    notFound();
  }

  return student;
}
