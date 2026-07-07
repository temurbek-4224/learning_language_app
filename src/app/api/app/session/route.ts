import { NextResponse } from "next/server";

import { setStudentSession, upsertTelegramStudent } from "@/lib/student-auth";
import { verifyTelegramInitData } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    initData?: unknown;
  } | null;
  const initData = typeof body?.initData === "string" ? body.initData : "";
  const telegramUser = verifyTelegramInitData(initData);

  if (!telegramUser) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const student = await upsertTelegramStudent(telegramUser);

  await setStudentSession(student.id);

  return NextResponse.json({ ok: true });
}
