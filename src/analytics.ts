/// <reference types="vite/client" />
import posthog from "posthog-js";

const projectApiKey = import.meta.env.VITE_POSTHOG_KEY?.trim();

if (projectApiKey) {
  posthog.init(projectApiKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: "history_change",
    capture_pageleave: true,
    person_profiles: "identified_only",
    disable_session_recording: true,
  });
}

/**
 * `account_handle` is the app username: an operator-friendly identifier, never
 * an email, display name, or reading/private-content field.
 */
export function identifyAnalyticsUser(userId: string, accountHandle: string): void {
  if (projectApiKey) posthog.identify(userId, { account_handle: accountHandle });
}

export function resetAnalyticsUser(): void {
  if (projectApiKey) posthog.reset();
}

export type AnalyticsEvent =
  | "book_add_started"
  | "book_added"
  | "book_upload_completed"
  | "book_upload_failed"
  | "book_upload_started"
  | "book_wiki_opened"
  | "login_completed"
  | "podcast_episode_completed"
  | "podcast_episode_played"
  | "podcast_generation_requested"
  | "reading_session_completed"
  | "reading_session_failed"
  | "reading_session_started"
  | "review_completed"
  | "sign_up_completed"
  | "weekly_goal_set";

type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

/**
 * Product analytics must stay metadata-only: never send book titles, authors,
 * source text, notes, transcripts, filenames, private URLs, or error messages.
 */
export function captureAnalyticsEvent(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties,
): void {
  if (projectApiKey) posthog.capture(event, properties);
}
