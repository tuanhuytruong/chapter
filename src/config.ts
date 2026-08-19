// Centralized environment config. Load local development values before any
// importing module reads config, because ESM dependencies evaluate before server.ts body.
import dotenv from "dotenv";
// Chapter's deployment configuration belongs to this release's .env.local.
// PM2 keeps inherited variables across reloads; without override they can silently
// point a new build at a stale bot/chat configuration.
dotenv.config({ path: ".env.local", override: true, quiet: true });

function optionalEnv(name: string): string {
  const raw = process.env[name] ?? "";
  const trimmed = raw.trim();
  // dotenv removes normal .env quotes, while PM2/shell injection can retain them.
  return /^(['"]).*\1$/.test(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
}

function boundedIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(optionalEnv(name));
  return Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
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
  billingVietQrEnabled: optionalEnv("BILLING_VIETQR_ENABLED") === "true",
  billingVietQrBankBin: optionalEnv("BILLING_VIETQR_BANK_BIN") || "970422",
  billingVietQrAccountNumber: optionalEnv("BILLING_VIETQR_ACCOUNT_NUMBER"),
  billingVietQrAccountName: optionalEnv("BILLING_VIETQR_ACCOUNT_NAME"),
  billingVietQrTemplate: optionalEnv("BILLING_VIETQR_TEMPLATE") || "IuPsscp",
  billingOrderExpiryMinutes: boundedIntegerEnv("BILLING_ORDER_EXPIRY_MINUTES", 30, 5, 120),
  port: Number(process.env.PORT ?? 3000),
  booksDir: process.env.CHAPTER_BOOKS_DIR ?? "/opt/chapter/workspace/books",
  appUrl: optionalEnv("APP_URL") || "http://localhost:3000",
  googleClientId: optionalEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: optionalEnv("GOOGLE_CLIENT_SECRET"),
  resendApiKey: optionalEnv("RESEND_API_KEY"),
  resendFrom: optionalEnv("RESEND_FROM") || "Chapter <no-reply@account.mrl.asia>",
  passwordResetTtlMinutes: Math.min(60, Math.max(15, Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 45))),
  authRateLimitWindowMs: boundedIntegerEnv("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60_000, 60_000, 60 * 60_000),
  authLoginMaxAttempts: boundedIntegerEnv("AUTH_LOGIN_MAX_ATTEMPTS", 10, 1, 100),
  authSignupMaxAttempts: boundedIntegerEnv("AUTH_SIGNUP_MAX_ATTEMPTS", 5, 1, 100),
  authPasswordResetMaxAttempts: boundedIntegerEnv("AUTH_PASSWORD_RESET_MAX_ATTEMPTS", 5, 1, 100),
  authOauthMaxAttempts: boundedIntegerEnv("AUTH_OAUTH_MAX_ATTEMPTS", 20, 1, 100),
  // Ordinary web requests should fail rather than consume the pool indefinitely.
  // Background AI/indexing work uses the explicit background DB helpers below.
  dbRequestStatementTimeoutMs: boundedIntegerEnv("DB_REQUEST_STATEMENT_TIMEOUT_MS", 12_000, 1_000, 60_000),
  dbRequestLockTimeoutMs: boundedIntegerEnv("DB_REQUEST_LOCK_TIMEOUT_MS", 2_000, 250, 15_000),
  dbBackgroundStatementTimeoutMs: boundedIntegerEnv("DB_BACKGROUND_STATEMENT_TIMEOUT_MS", 120_000, 10_000, 600_000),
  dbBackgroundLockTimeoutMs: boundedIntegerEnv("DB_BACKGROUND_LOCK_TIMEOUT_MS", 5_000, 250, 30_000),
};
