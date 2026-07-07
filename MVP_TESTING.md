# WordXotira MVP Deployment Testing

## Vercel Environment Variables

Set these in Vercel before deploying:

- `DATABASE_URL`
- `AUTH_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`
- `APP_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

For local development, `APP_URL` can be `http://localhost:3000`. For production Telegram testing, `APP_URL` must be the HTTPS Vercel URL:

```text
https://learning-language-app-indol.vercel.app
```

Production Mini App URL:

```text
https://learning-language-app-indol.vercel.app/app
```

Production webhook URL:

```text
https://learning-language-app-indol.vercel.app/api/telegram/webhook
```

## Deploy Steps

1. Push the current branch to GitHub.
2. Import or redeploy the project in Vercel.
3. Add all required environment variables in Vercel.
4. Redeploy after changing environment variables.
5. Run Prisma migrations against the production database.
6. Set the Telegram webhook after the deployment is live.

## Telegram Webhook Commands

Set the webhook to `${APP_URL}/api/telegram/webhook`:

```bash
npm run telegram:set-webhook
```

Check the current webhook URL and last Telegram delivery errors:

```bash
npm run telegram:webhook-info
```

The setup command uses `TELEGRAM_BOT_TOKEN` and sends `TELEGRAM_WEBHOOK_SECRET` as Telegram's `secret_token` when it is configured. Do not paste or commit the bot token.

## Test Class Invite

1. Sign in as a teacher in the production teacher panel:
   `https://learning-language-app-indol.vercel.app/teacher/classes`
2. Create a class or open an existing class.
3. Confirm the invite link is shown as `https://t.me/<TELEGRAM_BOT_USERNAME>?start=class_<inviteCode>`.
4. Copy the invite link:
   `https://t.me/wordxotira_bot?start=class_<code>`
5. Open the link in Telegram.
6. Confirm the bot replies:
   `Classga qo‘shildingiz: ...`
7. Confirm the reply includes the inline Mini App button:
   `Darslarni ochish`
8. Tap `Darslarni ochish`.
9. Confirm the Mini App opens.
10. In the teacher class page, confirm the student count increases.

Localhost class links may not work with the production webhook unless local and production use the same `DATABASE_URL`. For real Telegram testing, create the class in the production teacher panel and use the production invite link.

Manual command test:

```text
/start class_<code>
```

Expected result: the same join reply and `Darslarni ochish` inline button.

## Test Mini App

1. Open the bot message's Mini App button inside Telegram.
2. Confirm the student home page loads.
3. Confirm joined classes are listed under `/app/classes`.
4. On `/app/classes`, test joining by entering each supported format:
   `https://t.me/wordxotira_bot?start=class_abc123`
   `class_abc123`
   `abc123`
5. Confirm the newly joined class appears in the classes list.
6. Open a class and confirm assigned lessons are visible as placeholders only.

## Mini App Session Troubleshooting

- The Mini App must be opened inside Telegram so `https://telegram.org/js/telegram-web-app.js` can provide signed `initData`.
- If the app shows `Mini App faqat Telegram ichida ochilganda ishlaydi.`, reopen it from the bot's `Darslarni ochish` button inside Telegram.
- If production still shows the session error inside Telegram, confirm the bot's Mini App URL is `https://learning-language-app-indol.vercel.app/app`.
- Local browser testing still uses the `DEV_TELEGRAM_ID` fallback when `NODE_ENV` is not `production`.
- For real Telegram testing, use production classes from `https://learning-language-app-indol.vercel.app/teacher/classes`.

## Common Issues

- `APP_URL` still points to `localhost`, so Telegram cannot reach the deployed app.
- `APP_URL` is not `https://learning-language-app-indol.vercel.app` in Vercel.
- Telegram webhook was not set after deployment.
- Vercel environment variables changed but the app was not redeployed.
- `DATABASE_URL` is missing or points to the wrong database.
- `TELEGRAM_BOT_TOKEN` is wrong or belongs to another bot.
- `TELEGRAM_WEBHOOK_SECRET` in Vercel does not match the secret registered with Telegram.
