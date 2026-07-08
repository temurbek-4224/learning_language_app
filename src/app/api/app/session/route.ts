import { NextResponse } from "next/server";

import { setStudentSession, upsertTelegramStudent } from "@/lib/student-auth";
import { verifyTelegramInitData } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    initData?: unknown;
  } | null;
  const initData = typeof body?.initData === "string" ? body.initData : "";
  const telegramUser = initData ? verifyTelegramInitData(initData) : null;

  if (initData && !telegramUser) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (telegramUser) {
    const student = await upsertTelegramStudent(telegramUser);

    await setStudentSession(student.id);

    return NextResponse.json({ ok: true, devMode: false });
  }

  if (process.env.NODE_ENV === "production" || !process.env.DEV_TELEGRAM_ID) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const student = await upsertTelegramStudent({
    id: process.env.DEV_TELEGRAM_ID,
    username: process.env.DEV_USERNAME ?? null,
    firstName: process.env.DEV_FIRST_NAME ?? "Dev",
    lastName: process.env.DEV_LAST_NAME ?? "Student",
    languageCode: null,
  });

  await setStudentSession(student.id);

  return NextResponse.json({ ok: true, devMode: true });
}
