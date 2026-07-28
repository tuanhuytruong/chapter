// Centralized environment config. Load local development values before any
// importing module reads config, because ESM dependencies evaluate before server.ts body.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  nineRouterUrl:
    process.env.NINE_ROUTER_URL ?? "https://9router-ubt.mrl.asia/v1/chat/completions",
  nineRouterModel: process.env.NINE_ROUTER_MODEL ?? "n8n",
  nineRouterApiKey: process.env.NINE_ROUTER_API_KEY ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  podcastTelegramArchiveChatId: process.env.PODCAST_TELEGRAM_ARCHIVE_CHAT_ID ?? "",
  podcastCacheDir: process.env.PODCAST_CACHE_DIR ?? "/opt/chapter/workspace/podcast-cache",
  podcastCacheTtlHours: Number(process.env.PODCAST_CACHE_TTL_HOURS ?? 48),
  podcastLlmModel: process.env.PODCAST_LLM_MODEL ?? "",
  podcastTtsUrl: process.env.PODCAST_TTS_URL ?? "https://9router-ubt.mrl.asia/v1/audio/speech",
  podcastTtsMaxChars: Number(process.env.PODCAST_TTS_MAX_CHARS ?? 12_000),
  port: Number(process.env.PORT ?? 3000),
  booksDir: process.env.CHAPTER_BOOKS_DIR ?? "/opt/chapter/workspace/books",
};
