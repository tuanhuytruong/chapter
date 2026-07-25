// Fixed seeds give every companion a stable, geometric DiceBear Bottts Neutral mascot.
// The DB stores only `animal:<id>`, never an arbitrary third-party URL.
export const AVATAR_PRESETS = [
  { id: "otter", label: "Otter", seed: "amber-otter", tone: "bg-orange-100" },
  { id: "red-panda", label: "Red panda", seed: "russet-panda", tone: "bg-amber-100" },
  { id: "cat", label: "Cat", seed: "moss-cat", tone: "bg-rose-100" },
  { id: "rabbit", label: "Rabbit", seed: "lilac-rabbit", tone: "bg-violet-100" },
  { id: "panda", label: "Panda", seed: "ink-panda", tone: "bg-slate-100" },
  { id: "bear", label: "Bear", seed: "honey-bear", tone: "bg-yellow-100" },
  { id: "koala", label: "Koala", seed: "eucalyptus-koala", tone: "bg-stone-100" },
  { id: "penguin", label: "Penguin", seed: "river-penguin", tone: "bg-sky-100" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];
export const DEFAULT_AVATAR_PRESET: AvatarPresetId = "otter";

export function avatarValueForPreset(id: AvatarPresetId): string { return `animal:${id}`; }
export function avatarSrcForPreset(id: AvatarPresetId, size = 128): string {
  const preset = AVATAR_PRESETS.find((item) => item.id === id)!;
  return `https://api.dicebear.com/10.x/bottts-neutral/svg?seed=${encodeURIComponent(preset.seed)}&backgroundColor=f6f1e8&radius=50&size=${size}`;
}
export function isAvatarPresetValue(value: unknown): value is string {
  return typeof value === "string" && AVATAR_PRESETS.some(({ id }) => value === avatarValueForPreset(id));
}
export function presetFromAvatarValue(value?: string | null) {
  return AVATAR_PRESETS.find(({ id }) => value === avatarValueForPreset(id));
}
