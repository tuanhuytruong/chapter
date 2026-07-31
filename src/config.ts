// Centralized environment config. Load local development values before any
// importing module reads config, because ESM dependencies evaluate before server.ts body.
import dotenv from "dotenv";
// Chapter's deployment configuration belongs to this release's .env.local.
// PM2 keeps inherited variables across reloads; without override they can silently
// point a new build at a stale bot/chat configuration.
dotenv.config({ path: ".env.local", override: true });

function optionalEnv(name: string): string {
  const raw = process.env[name] ?? "";
  const trimmed = raw.trim();
  // dotenv removes normal .env quotes, while PM2/shell injection can retain them.
  return /^(['"]).*\1$/.test(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
}

function appEnvironment(): "prd" | "dev" {
  const value = optionalEnv("APP_ENV") || "prd";
  if (value !== "prd" && value !== "dev") throw new Error("APP_ENV must be exactly 'prd' or 'dev'");
  return value;
}

export const config = {
  appEnv: appEnvironment(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  nineRouterUrl:
    process.env.NINE_ROUTER_URL ?? "https://9router-ubt.mrl.asia/v1/chat/completions",
  nineRouterModel: process.env.NINE_ROUTER_MODEL ?? "n8n",
  nineRouterApiKey: process.env.NINE_ROUTER_API_KEY ?? "",
  telegramBotToken: optionalEnv("TELEGRAM_BOT_TOKEN"),
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  podcastTelegramArchiveChatId: optionalEnv("PODCAST_TELEGRAM_ARCHIVE_CHAT_ID"),
  podcastCacheDir: process.env.PODCAST_CACHE_DIR ?? "/opt/chapter/workspace/podcast-cache",
  podcastCacheTtlHours: Number(process.env.PODCAST_CACHE_TTL_HOURS ?? 48),
  podcastLlmModel: process.env.PODCAST_LLM_MODEL ?? "",
  podcastTtsUrl: process.env.PODCAST_TTS_URL ?? "https://9router-ubt.mrl.asia/v1/audio/speech",
  podcastTtsMaxChars: Number(process.env.PODCAST_TTS_MAX_CHARS ?? 12_000),
  port: Number(process.env.PORT ?? 3000),
  booksDir: process.env.CHAPTER_BOOKS_DIR ?? "/opt/chapter/workspace/books",
  appUrl: optionalEnv("APP_URL") || "http://localhost:3000",
  googleClientId: optionalEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: optionalEnv("GOOGLE_CLIENT_SECRET"),
  resendApiKey: optionalEnv("RESEND_API_KEY"),
  resendFrom: optionalEnv("RESEND_FROM") || "Chapter <no-reply@account.mrl.asia>",
  passwordResetTtlMinutes: Math.min(60, Math.max(15, Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 45))),
};
