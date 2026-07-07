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

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required.");
}

async function main() {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getWebhookInfo`,
  );
  const data = await response.json();

  if (!response.ok || !data.ok) {
    console.error(data);
    process.exit(1);
  }

  const info = data.result ?? {};

  console.log(`Webhook URL: ${info.url || "(not set)"}`);
  console.log(`Pending updates: ${info.pending_update_count ?? 0}`);

  if (info.last_error_date) {
    console.log(
      `Last error date: ${new Date(info.last_error_date * 1000).toISOString()}`,
    );
  }

  if (info.last_error_message) {
    console.log(`Last error: ${info.last_error_message}`);
  }

  if (info.allowed_updates?.length) {
    console.log(`Allowed updates: ${info.allowed_updates.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
