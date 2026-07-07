const fs = require("node:fs");
const path = require("node:path");

const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required.");
}

if (!appUrl) {
  throw new Error("APP_URL is required.");
}

async function main() {
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      ...(secret ? { secret_token: secret } : {}),
      allowed_updates: ["message"],
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.ok) {
    console.error(data);
    process.exit(1);
  }

  console.log(`Telegram webhook set: ${webhookUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
