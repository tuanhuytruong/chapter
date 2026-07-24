export const AVATAR_PRESETS = [
  { id: "otter", label: "Otter", emoji: "🦦", tone: "bg-orange-100" },
  { id: "red-panda", label: "Red panda", emoji: "🦊", tone: "bg-amber-100" },
  { id: "cat", label: "Cat", emoji: "🐱", tone: "bg-rose-100" },
  { id: "rabbit", label: "Rabbit", emoji: "🐰", tone: "bg-violet-100" },
  { id: "panda", label: "Panda", emoji: "🐼", tone: "bg-slate-100" },
  { id: "bear", label: "Bear", emoji: "🐻", tone: "bg-yellow-100" },
  { id: "koala", label: "Koala", emoji: "🐨", tone: "bg-stone-100" },
  { id: "penguin", label: "Penguin", emoji: "🐧", tone: "bg-sky-100" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];
export const DEFAULT_AVATAR_PRESET: AvatarPresetId = "otter";

export function avatarValueForPreset(id: AvatarPresetId): string { return `animal:${id}`; }
export function isAvatarPresetValue(value: unknown): value is string {
  return typeof value === "string" && AVATAR_PRESETS.some(({ id }) => value === avatarValueForPreset(id));
}
export function presetFromAvatarValue(value?: string | null) {
  return AVATAR_PRESETS.find(({ id }) => value === avatarValueForPreset(id));
}
