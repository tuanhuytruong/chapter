// Centralized environment config (Phase 3).
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  nineRouterUrl:
    process.env.NINE_ROUTER_URL ?? "https://9router-ubt.mrl.asia/v1/chat/completions",
  nineRouterModel: process.env.NINE_ROUTER_MODEL ?? "n8n",
  nineRouterApiKey: process.env.NINE_ROUTER_API_KEY ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  port: Number(process.env.PORT ?? 3000),
  booksDir: process.env.CHAPTER_BOOKS_DIR ?? "/opt/chapter/workspace/books",
};
