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

export function identifyAnalyticsUser(userId: string): void {
  if (projectApiKey) posthog.identify(userId);
}

export function resetAnalyticsUser(): void {
  if (projectApiKey) posthog.reset();
}

export function captureAnalyticsEvent(
  event: string,
  properties?: Record<string, boolean | number | string | null | undefined>,
): void {
  if (projectApiKey) posthog.capture(event, properties);
}
