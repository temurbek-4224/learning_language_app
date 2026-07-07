import { Context, Telegraf } from "telegraf";
import type { Update } from "telegraf/types";

import { prisma } from "@/lib/prisma";
import { upsertTelegramStudent } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

function getMiniAppUrl() {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");

  return appUrl ? `${appUrl}/app` : null;
}

function miniAppKeyboard() {
  const url = getMiniAppUrl();

  if (!url) {
    return undefined;
  }

  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Darslarni ochish",
            web_app: { url },
          },
        ],
      ],
    },
  };
}

async function handleStart(ctx: Context) {
  const from = ctx.from;

  if (!from) {
    return;
  }

  const student = await upsertTelegramStudent({
    id: String(from.id),
    username: from.username ?? null,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
    languageCode: from.language_code ?? null,
  });
  const text =
    ctx.message && "text" in ctx.message && typeof ctx.message.text === "string"
      ? ctx.message.text
      : "";
  const startParam = text.split(/\s+/)[1] ?? "";

  if (!startParam.startsWith("class_")) {
    await ctx.reply(
      "WordXotira'ga xush kelibsiz. Ustozingiz bergan class link orqali darslarga qo'shiling.",
      miniAppKeyboard(),
    );
    return;
  }

  const inviteCode = startParam.replace(/^class_/, "").trim();
  const classRoom = await prisma.classRoom.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      title: true,
      isActive: true,
    },
  });

  if (!classRoom || !classRoom.isActive) {
    await ctx.reply("Bu class link topilmadi yoki faol emas.");
    return;
  }

  await prisma.classMember.upsert({
    where: {
      classId_studentId: {
        classId: classRoom.id,
        studentId: student.id,
      },
    },
    create: {
      classId: classRoom.id,
      studentId: student.id,
    },
    update: {},
  });

  await ctx.reply(
    `${classRoom.title} classiga qo'shildingiz. Darslarni Mini App orqali oching.`,
    miniAppKeyboard(),
  );
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (
    secret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return new Response("Telegram bot token is not configured.", {
      status: 500,
    });
  }

  const bot = new Telegraf(token);

  bot.start(handleStart);

  const update = (await request.json()) as Update;

  await bot.handleUpdate(update);

  return Response.json({ ok: true });
}
