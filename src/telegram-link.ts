import crypto from "crypto";

export const LINK_PREFIX = "chapter_";
export const LINK_TTL_MS = 15 * 60 * 1000;

export function createLinkToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function parseStartToken(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const match = text.trim().match(/^\/start\s+chapter_([A-Za-z0-9_-]{24,})$/);
  return match?.[1] || null;
}

export function linkExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + LINK_TTL_MS);
}

export function isLinkActive(expiresAt: Date | string | null | undefined, now = new Date()): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() > now.getTime();
}

export function deepLink(botUsername: string, token: string): string {
  return `https://t.me/${botUsername.replace(/^@/, "")}?start=${LINK_PREFIX}${token}`;
}

export function telegramUpdate(input: unknown): { chatId: string; token: string } | null {
  const update = input as { message?: { chat?: { id?: string | number }; text?: unknown } };
  const chatId = update?.message?.chat?.id;
  const token = parseStartToken(update?.message?.text);
  if ((typeof chatId !== "string" && typeof chatId !== "number") || !token) return null;
  return { chatId: String(chatId), token };
}

export function telegramLinkFixtureCheck(): void {
  const token = createLinkToken();
  if (!/^[A-Za-z0-9_-]{24,}$/.test(token)) throw new Error("invalid token shape");
  if (parseStartToken(`/start chapter_${token}`) !== token) throw new Error("start parsing failed");
  if (parseStartToken("/start wrong") !== null) throw new Error("invalid start accepted");
  const expiry = linkExpiresAt(new Date("2026-01-01T00:00:00.000Z"));
  if (!isLinkActive(expiry, new Date("2026-01-01T00:14:59.000Z"))) throw new Error("active link rejected");
  if (isLinkActive(expiry, new Date("2026-01-01T00:15:00.000Z"))) throw new Error("expired link accepted");
}
