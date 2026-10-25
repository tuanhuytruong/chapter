export const feedbackKinds = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof feedbackKinds)[number];

export const feedbackPlatforms = [
  "web_desktop",
  "web_android",
  "web_ios",
  "unknown",
] as const;
export type FeedbackPlatform = (typeof feedbackPlatforms)[number];

export const feedbackBrowsers = [
  "chrome",
  "safari",
  "firefox",
  "edge",
  "other",
  "unknown",
] as const;
export type FeedbackBrowser = (typeof feedbackBrowsers)[number];

export type FeedbackInput = {
  kind: FeedbackKind;
  message: string;
  routePath: string;
  clientPlatform: FeedbackPlatform;
  browserFamily: FeedbackBrowser;
};

const hasOnlyExpectedKeys = (value: Record<string, unknown>) =>
  Object.keys(value).every((key) =>
    ["kind", "message", "routePath", "clientPlatform", "browserFamily"].includes(key),
  );

const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export function validateFeedbackInput(value: unknown):
  | { ok: true; value: FeedbackInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Feedback must be a JSON object." };
  }
  const body = value as Record<string, unknown>;
  if (!hasOnlyExpectedKeys(body)) {
    return { ok: false, error: "Feedback contains an unsupported field." };
  }
  if (!isOneOf(body.kind, feedbackKinds)) {
    return { ok: false, error: "Choose a feedback type." };
  }
  if (typeof body.message !== "string") {
    return { ok: false, error: "Write a short feedback message." };
  }
  const message = body.message.replace(/\r\n?/g, "\n").trim();
  if (message.length < 10 || message.length > 2000) {
    return { ok: false, error: "Feedback must be between 10 and 2,000 characters." };
  }
  if (typeof body.routePath !== "string" || body.routePath.length > 300 || !/^\/[^?#]*$/.test(body.routePath)) {
    return { ok: false, error: "Feedback page context must be a valid pathname." };
  }
  if (!isOneOf(body.clientPlatform, feedbackPlatforms) || !isOneOf(body.browserFamily, feedbackBrowsers)) {
    return { ok: false, error: "Feedback browser context is invalid." };
  }
  return {
    ok: true,
    value: {
      kind: body.kind,
      message,
      routePath: body.routePath,
      clientPlatform: body.clientPlatform,
      browserFamily: body.browserFamily,
    },
  };
}

export function feedbackKindLabel(kind: FeedbackKind): string {
  return kind === "bug" ? "Bug" : kind === "idea" ? "Idea" : "Other";
}
