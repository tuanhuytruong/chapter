import React, { useEffect, useState } from "react";
import { Check, Loader2, Save, UserRound } from "lucide-react";
import { useAuth } from "../AuthContext";
import { AVATAR_PRESETS, avatarValueForPreset, presetFromAvatarValue, type AvatarPresetId } from "../avatar-presets";
import AnimalAvatar from "../components/AnimalAvatar";

type ProfileResponse = { username: string; displayName: string; avatarUrl: string | null };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...init });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Request failed");
  return JSON.parse(text) as T;
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatar, setAvatar] = useState<AvatarPresetId>(presetFromAvatarValue(user?.avatarUrl)?.id || "otter");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void request<ProfileResponse>("/api/auth/profile").then((profile) => {
      setDisplayName(profile.displayName);
      setAvatar(presetFromAvatarValue(profile.avatarUrl)?.id || "otter");
    }).catch(() => setError("Could not load your profile."));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setSaved(false);
    try {
      const data = await request<{ user: typeof user }>("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ displayName, avatarUrl: avatarValueForPreset(avatar) }) });
      if (data.user) updateUser(data.user);
      setSaved(true);
    } catch (err: any) { setError(err.message || "Could not save your profile."); }
    finally { setBusy(false); }
  };

  const current = AVATAR_PRESETS.find(({ id }) => id === avatar)!;
  return <main className="mx-auto max-w-2xl space-y-5">
    <section><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Profile</p><h1 className="mt-1 text-3xl font-bold">Your reading identity</h1><p className="mt-2 text-sm text-natural-stone">Choose a small companion for the places Chapter recognizes you.</p></section>
    <form onSubmit={save} className="space-y-6 rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-4"><div className={`flex h-16 w-16 overflow-hidden rounded-[22px] ${current.tone} shadow-sm`}><AnimalAvatar id={current.id} alt={`${current.label} animal companion`} className="h-full w-full" /></div><div><p className="font-sans text-sm font-bold text-natural-dark">{displayName || "Your profile"}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-natural-stone">@{user?.username}</p></div></div>
      <label className="block"><span className="font-sans text-xs font-bold text-natural-dark">Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} required className="mt-2 block min-h-11 w-full rounded-xl border border-natural-border bg-white px-3 font-sans text-sm text-natural-dark outline-none focus:border-natural-sage focus:ring-2 focus:ring-natural-sage/15" /></label>
      <fieldset><legend className="font-sans text-xs font-bold text-natural-dark">Choose an animal companion</legend><div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">{AVATAR_PRESETS.map((item) => <button key={item.id} type="button" onClick={() => setAvatar(item.id)} aria-label={`Choose ${item.label}`} aria-pressed={item.id === avatar} className={`relative flex min-h-16 flex-col items-center justify-center overflow-hidden rounded-2xl border transition ${item.id === avatar ? "border-natural-sage bg-natural-sage/10 ring-2 ring-natural-sage/25" : "border-natural-border bg-white hover:border-natural-sage/45"}`}><AnimalAvatar id={item.id} className="h-9 w-9 rounded-xl" /><span className="mt-1 font-sans text-[9px] font-bold text-natural-stone">{item.label}</span>{item.id === avatar && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-natural-sage" />}</button>)}</div></fieldset>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}{saved && <p className="inline-flex items-center gap-1.5 text-xs font-bold text-natural-sage"><Check className="h-4 w-4" /> Profile saved</p>}
      <button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-natural-sage px-4 font-sans text-xs font-bold text-white hover:bg-natural-sage-dark disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile</button>
    </form>
    <section className="rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-natural-sage/10 text-natural-sage"><UserRound className="h-5 w-5" /></div><div><h2 className="font-sans text-sm font-bold text-natural-dark">Keep it simple</h2><p className="mt-1 text-xs leading-relaxed text-natural-stone">Your username stays fixed. You can return here whenever you want to change the name and companion shown inside Chapter.</p></div></div></section>
  </main>;
}
