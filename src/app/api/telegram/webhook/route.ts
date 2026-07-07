import { Context, Telegraf } from "telegraf";
import type { Update } from "telegraf/types";

import { prisma } from "@/lib/prisma";
import { upsertTelegramStudent } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

const MINI_APP_BUTTON_TEXT = "Darslarni ochish";
const FALLBACK_MESSAGE =
  "WordXotira’ga xush kelibsiz. Ustozingiz bergan class link orqali darslarga qo‘shiling.";
const ERROR_MESSAGE =
  "Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko‘ring.";

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
            text: MINI_APP_BUTTON_TEXT,
            web_app: { url },
          },
        ],
      ],
    },
  };
}

function getMessageText(ctx: Context) {
  const text =
    ctx.message && "text" in ctx.message && typeof ctx.message.text === "string"
      ? ctx.message.text
      : "";

  return text.trim();
}

function extractInviteCodeFromText(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  const startMatch = trimmed.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  const startPayload = startMatch?.[1]?.trim();

  if (startPayload?.startsWith("class_")) {
    return startPayload.replace(/^class_/, "").trim();
  }

  try {
    const url = new URL(trimmed);
    const startParam = url.searchParams.get("start");

    if (startParam?.startsWith("class_")) {
      return startParam.replace(/^class_/, "").trim();
    }
  } catch {
    // Not a URL; continue with direct payload parsing.
  }

  if (trimmed.startsWith("class_")) {
    return trimmed.replace(/^class_/, "").trim();
  }

  return "";
}

function isStartWithoutPayload(text: string) {
  return /^\/start(?:@\w+)?$/i.test(text.trim());
}

function isStartMessage(text: string) {
  return /^\/start(?:@\w+)?(?:\s|$)/i.test(text.trim());
}

function getUpdateMessageChatId(update: Update | null) {
  if (!update || !("message" in update)) {
    return null;
  }

  return update.message.chat.id;
}

async function replyWithMiniApp(ctx: Context, text: string) {
  try {
    await ctx.reply(text, miniAppKeyboard());
    console.log("[telegram-webhook] sendMessage success", {
      hasMiniAppUrl: Boolean(getMiniAppUrl()),
    });
  } catch (error) {
    console.error("[telegram-webhook] sendMessage fail", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

async function joinClassFromInvite(ctx: Context, inviteCode: string) {
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

  console.log("[telegram-webhook] extracted inviteCode", {
    inviteCode,
    appUrlExists: Boolean(process.env.APP_URL),
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
    classFound: Boolean(classRoom),
  });

  if (!classRoom || !classRoom.isActive) {
    console.log("[telegram-webhook] join result", { result: "invalid" });
    await replyWithMiniApp(ctx, "Bu class link topilmadi yoki faol emas.");
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

  console.log("[telegram-webhook] join result", {
    result: joined ? "joined" : "already",
  });

  await replyWithMiniApp(
    ctx,
    joined
      ? `Classga qo‘shildingiz: ${classRoom.title}`
      : "Siz bu classga allaqachon qo‘shilgansiz.",
  );
}

async function handleTextMessage(ctx: Context) {
  const text = getMessageText(ctx);

  console.log("[telegram-webhook] received message text", {
    text,
    appUrlExists: Boolean(process.env.APP_URL),
  });

  if (!text) {
    return;
  }

  if (isStartWithoutPayload(text)) {
    await replyWithMiniApp(ctx, FALLBACK_MESSAGE);
    return;
  }

  const inviteCode = extractInviteCodeFromText(text);

  console.log("[telegram-webhook] extracted inviteCode", {
    inviteCode,
    appUrlExists: Boolean(process.env.APP_URL),
  });

  if (inviteCode) {
    await joinClassFromInvite(ctx, inviteCode);
    return;
  }

  if (isStartMessage(text)) {
    await replyWithMiniApp(ctx, FALLBACK_MESSAGE);
  }
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
    console.error("[telegram-webhook] token missing");
    return Response.json({ ok: false });
  }

  const bot = new Telegraf(token);

  bot.on("text", handleTextMessage);

  let update: Update | null = null;

  try {
    update = (await request.json()) as Update;
    await bot.handleUpdate(update);
  } catch (error) {
    console.error("[telegram-webhook] update handling failed", {
      updateId: update?.update_id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const chatId = getUpdateMessageChatId(update);

    if (chatId) {
      try {
        await bot.telegram.sendMessage(chatId, ERROR_MESSAGE, {
          reply_markup: miniAppKeyboard()?.reply_markup,
        });
        console.log("[telegram-webhook] sendMessage success", {
          hasMiniAppUrl: Boolean(getMiniAppUrl()),
        });
      } catch (sendError) {
        console.error("[telegram-webhook] sendMessage fail", {
          error:
            sendError instanceof Error ? sendError.message : "Unknown error",
        });
      }
    }
  }

  return Response.json({ ok: true });
}
