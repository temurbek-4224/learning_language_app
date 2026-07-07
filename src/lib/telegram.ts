import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramAuthUser = {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
};

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  return token;
}

export function verifyTelegramInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return null;
  }

  params.delete("hash");
  const checkString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(getBotToken())
    .digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const calculatedBuffer = Buffer.from(calculatedHash, "hex");

  if (
    hashBuffer.length !== calculatedBuffer.length ||
    !timingSafeEqual(hashBuffer, calculatedBuffer)
  ) {
    return null;
  }

  const userJson = params.get("user");

  if (!userJson) {
    return null;
  }

  try {
    const user = JSON.parse(userJson) as {
      id?: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
    };

    if (!user.id) {
      return null;
    }

    return {
      id: String(user.id),
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      languageCode: user.language_code ?? null,
    } satisfies TelegramAuthUser;
  } catch {
    return null;
  }
}
