/// <reference types="vite/client" />
import type posthogType from "posthog-js";

const projectApiKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
const deploymentEnvironment = import.meta.env.VITE_POSTHOG_ENVIRONMENT?.trim();

if (projectApiKey && !deploymentEnvironment) {
  console.warn("PostHog is enabled without VITE_POSTHOG_ENVIRONMENT; events will be labeled unknown.");
}

const analyticsContext = {
  environment: deploymentEnvironment || "unknown",
};

let posthogLoader: Promise<typeof posthogType | null> | null = null;

function getPostHog(): Promise<typeof posthogType | null> {
  if (!projectApiKey) return Promise.resolve(null);
  if (!posthogLoader) {
    posthogLoader = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(projectApiKey, {
        api_host: import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
        defaults: "2026-05-30", autocapture: false, capture_pageview: false, capture_pageleave: false,
        person_profiles: "identified_only", disable_session_recording: true,
        // Chapter analytics is metadata-only. Initial attribution bypasses before_send
        // via feature-flag person_properties and would persist private query flags.
        save_referrer: false, save_campaign_params: false,
        before_send: (event) => {
          if (!event) return event;
          // SDK-enriched current/referring URLs must not leak rollout flags.
          const clean = (value: unknown): unknown => {
            if (typeof value === 'string' && /uiPreview(?:=|%3D)/i.test(value)) {
              try { const url = new URL(value); url.searchParams.delete('uiPreview'); return url.toString(); } catch { return undefined; }
            }
            if (Array.isArray(value)) return value.map(clean);
            if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'uiPreview').map(([key, item]) => [key, clean(item)]));
            return value;
          };
          event.properties = clean(event.properties) as typeof event.properties;
          return event;
        },
      });
      posthog.register(analyticsContext);
      return posthog;
    }).catch(() => null);
  }
  return posthogLoader;
}

/**
 * `account_handle` is the app username: an operator-friendly identifier, never
 * an email, display name, or reading/private-content field.
 */
export function identifyAnalyticsUser(userId: string, accountHandle: string): void {
  void getPostHog().then((posthog) => posthog?.identify(userId, { account_handle: accountHandle }));
}

export function resetAnalyticsUser(): void {
  void getPostHog().then((posthog) => posthog?.reset());
}

export type AnalyticsEvent =
  | "book_add_started"
  | "book_added"
  | "book_upload_completed"
  | "book_upload_failed"
  | "book_upload_started"
  | "book_wiki_opened"
  | "feedback_submitted"
  | "login_completed"
  | "podcast_episode_completed"
  | "podcast_episode_played"
  | "podcast_generation_requested"
  | "reading_session_completed"
  | "reading_session_failed"
  | "reading_session_started"
  | "quiet_streak_milestone_seen"
  | "return_responded"
  | "return_shown"
  | "return_source_opened"
  | "review_completed"
  | "route_perf_sample"
  | "sign_up_completed"
  | "weekly_goal_set"
  | "reference_card_draft_requested"
  | "reference_card_created"
  | "reference_card_updated"
  | "reference_card_used"
  | "reference_card_deleted";

type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

export function routeAnalyticsId(pathname: string): string {
  const normalised = pathname.replace(/\/+$/, "") || "/";
  if (/^\/books\/[^/]+$/.test(normalised)) return "/books/:id";
  return normalised;
}

function durationBucket(durationMs: number): string {
  if (durationMs < 250) return "under_250ms";
  if (durationMs < 750) return "250_749ms";
  if (durationMs < 1500) return "750_1499ms";
  if (durationMs < 3000) return "1500_2999ms";
  return "3000ms_plus";
}

/** Records route responsiveness without URLs, IDs, titles, or reader content. */
export function captureRoutePerformance(pathname: string, startedAt: number): void {
  captureAnalyticsEvent("route_perf_sample", {
    route: routeAnalyticsId(pathname),
    render_duration_bucket: durationBucket(Math.max(0, performance.now() - startedAt)),
    device_class: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
  });
}

/**
 * Product analytics must stay metadata-only: never send book titles, authors,
 * source text, notes, transcripts, filenames, private URLs, or error messages.
 */
export function captureAnalyticsEvent(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties,
): void {
  void getPostHog().then((posthog) => posthog?.capture(event, properties));
}
