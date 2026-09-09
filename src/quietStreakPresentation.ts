import type { QuietStreakTierId } from "./quietStreak";

export type QuietStreakTierPresentation = {
  card: { earned: string; ahead: string; icon: string; label: string };
  chip: string;
  menu: { icon: string; value: string };
};

export const QUIET_STREAK_TIER_PRESENTATION: Record<QuietStreakTierId, QuietStreakTierPresentation> = {
  "first-thread": { card: { earned: "border-emerald-600/55 bg-emerald-500/10", ahead: "border-emerald-600/35 bg-emerald-500/5", icon: "bg-emerald-700 text-white", label: "text-emerald-700 dark:text-emerald-300" }, chip: "border-emerald-600/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", menu: { icon: "text-emerald-700 dark:text-emerald-300", value: "text-emerald-700 dark:text-emerald-300" } },
  "steady-reader": { card: { earned: "border-teal-600/55 bg-teal-500/10", ahead: "border-teal-600/35 bg-teal-500/5", icon: "bg-teal-700 text-white", label: "text-teal-700 dark:text-teal-300" }, chip: "border-teal-600/45 bg-teal-500/10 text-teal-700 dark:text-teal-300", menu: { icon: "text-teal-700 dark:text-teal-300", value: "text-teal-700 dark:text-teal-300" } },
  "quiet-practice": { card: { earned: "border-orange-600/55 bg-orange-500/10", ahead: "border-orange-600/35 bg-orange-500/5", icon: "bg-orange-700 text-white", label: "text-orange-700 dark:text-orange-300" }, chip: "border-orange-600/45 bg-orange-500/10 text-orange-700 dark:text-orange-300", menu: { icon: "text-orange-700 dark:text-orange-300", value: "text-orange-700 dark:text-orange-300" } },
  "deep-current": { card: { earned: "border-[#526AA3]/60 bg-[#526AA3]/10", ahead: "border-[#526AA3]/40 bg-[#526AA3]/5", icon: "bg-[#526AA3] text-white", label: "text-[#455A8B] dark:text-[#B5C6FA]" }, chip: "border-[#526AA3]/45 bg-[#526AA3]/10 text-[#455A8B] dark:text-[#B5C6FA]", menu: { icon: "text-[#455A8B] dark:text-[#B5C6FA]", value: "text-[#455A8B] dark:text-[#B5C6FA]" } },
  "quiet-horizon": { card: { earned: "border-sky-600/55 bg-sky-500/10", ahead: "border-sky-600/35 bg-sky-500/5", icon: "bg-sky-700 text-white", label: "text-sky-700 dark:text-sky-300" }, chip: "border-sky-600/45 bg-sky-500/10 text-sky-700 dark:text-sky-300", menu: { icon: "text-sky-700 dark:text-sky-300", value: "text-sky-700 dark:text-sky-300" } },
  "deepened-practice": { card: { earned: "border-[#8B4F73]/60 bg-[#8B4F73]/10", ahead: "border-[#8B4F73]/40 bg-[#8B4F73]/5", icon: "bg-[#8B4F73] text-white", label: "text-[#7A4164] dark:text-[#E0B0CB]" }, chip: "border-[#8B4F73]/45 bg-[#8B4F73]/10 text-[#7A4164] dark:text-[#E0B0CB]", menu: { icon: "text-[#7A4164] dark:text-[#E0B0CB]", value: "text-[#7A4164] dark:text-[#E0B0CB]" } },
  "reading-life": { card: { earned: "border-[#62774A]/60 bg-[#62774A]/10", ahead: "border-[#62774A]/40 bg-[#62774A]/5", icon: "bg-[#62774A] text-white", label: "text-[#52653D] dark:text-[#C3DDA7]" }, chip: "border-[#62774A]/45 bg-[#62774A]/10 text-[#52653D] dark:text-[#C3DDA7]", menu: { icon: "text-[#52653D] dark:text-[#C3DDA7]", value: "text-[#52653D] dark:text-[#C3DDA7]" } },
};

const neutral: QuietStreakTierPresentation = { card: { earned: "border-natural-border bg-natural-cream", ahead: "border-natural-border bg-natural-cream", icon: "bg-natural-bg text-natural-stone", label: "text-natural-stone" }, chip: "border-natural-border bg-natural-cream text-natural-stone", menu: { icon: "text-natural-sage", value: "text-natural-stone" } };
export function getQuietStreakTierPresentation(id?: QuietStreakTierId | null): QuietStreakTierPresentation { return id ? QUIET_STREAK_TIER_PRESENTATION[id] : neutral; }
