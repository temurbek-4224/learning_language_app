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

function extractStartParam(ctx: Context) {
  const text =
    ctx.message && "text" in ctx.message && typeof ctx.message.text === "string"
      ? ctx.message.text
      : "";

  return text.split(/\s+/)[1]?.trim() ?? "";
}

async function handleStart(ctx: Context) {
  const from = ctx.from;

  if (!from) {
    return;
  }

  const startParam = extractStartParam(ctx);

  console.log("[telegram-webhook] received start payload", {
    hasPayload: Boolean(startParam),
    payloadType: startParam.startsWith("class_") ? "class" : "other",
  });

  const student = await upsertTelegramStudent({
    id: String(from.id),
    username: from.username ?? null,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
    languageCode: from.language_code ?? null,
  });

  if (!startParam.startsWith("class_")) {
    await ctx.reply(
      "WordXotira'ga xush kelibsiz. Ustozingiz bergan class link orqali darslarga qo'shiling.",
      miniAppKeyboard(),
    );
    return;
  }

  const inviteCode = startParam.replace(/^class_/, "").trim();

  console.log("[telegram-webhook] extracted inviteCode", {
    hasInviteCode: Boolean(inviteCode),
  });

  const classRoom = await prisma.classRoom.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      title: true,
      isActive: true,
    },
  });

  console.log("[telegram-webhook] class lookup", {
    classFound: Boolean(classRoom?.isActive),
  });

  if (!classRoom || !classRoom.isActive) {
    await ctx.reply("Bu class link topilmadi yoki faol emas.");
    return;
  }

  const existingMembership = await prisma.classMember.findUnique({
    where: {
      classId_studentId: {
        classId: classRoom.id,
        studentId: student.id,
      },
    },
    select: { id: true },
  });
  const joined = !existingMembership;

  if (joined) {
    await prisma.classMember.create({
      data: {
        classId: classRoom.id,
        studentId: student.id,
      },
    });
  }

  console.log("[telegram-webhook] membership result", {
    studentJoined: joined,
  });

  await ctx.reply(
    joined
      ? `Classga qo'shildingiz: ${classRoom.title}`
      : "Siz bu classga allaqachon qo'shilgansiz.",
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
