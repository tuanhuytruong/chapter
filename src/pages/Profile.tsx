import React, { useEffect, useState } from "react";
import { Check, Loader2, Save, UserRound } from "lucide-react";
import { useAuth } from "../AuthContext";
import { AVATAR_PRESETS, avatarValueForPreset, presetFromAvatarValue, type AvatarPresetId } from "../avatar-presets";
import AnimalAvatar from "../components/AnimalAvatar";
import PageHeader from "../components/PageHeader";

type ProfileResponse = { username: string; displayName: string; avatarUrl: string | null; email: string | null; googleConnected: boolean; hasPassword: boolean };

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
  const [identity, setIdentity] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    void request<ProfileResponse>("/api/auth/profile").then((profile) => {
      setDisplayName(profile.displayName);
      setAvatar(presetFromAvatarValue(profile.avatarUrl)?.id || "otter");
      setIdentity(profile);
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
    <PageHeader eyebrow="Profile" title="Your reading identity" description="Choose a small companion for the places Chapter recognizes you." titleClassName="mt-1 text-3xl font-bold" descriptionClassName="mt-2 text-sm text-natural-stone" />
    <form onSubmit={save} className="space-y-6 rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-4"><div className={`flex h-16 w-16 overflow-hidden rounded-[22px] ${current.tone} shadow-sm`}><AnimalAvatar id={current.id} alt={`${current.label} animal companion`} className="h-full w-full" /></div><div><p className="font-sans text-sm font-bold text-natural-dark">{displayName || "Your profile"}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-natural-stone">@{user?.username}</p></div></div>
      <label className="block"><span className="font-sans text-xs font-bold text-natural-dark">Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} required className="mt-2 block min-h-11 w-full rounded-xl border border-natural-border bg-white px-3 font-sans text-sm text-natural-dark outline-none focus:border-natural-sage focus:ring-2 focus:ring-natural-sage/15" /></label>
      <fieldset><legend className="font-sans text-xs font-bold text-natural-dark">Choose an animal companion</legend><div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">{AVATAR_PRESETS.map((item) => <button key={item.id} type="button" onClick={() => setAvatar(item.id)} aria-label={`Choose ${item.label}`} aria-pressed={item.id === avatar} className={`relative flex min-h-16 flex-col items-center justify-center overflow-hidden rounded-2xl border transition ${item.id === avatar ? "border-natural-sage bg-natural-sage/10 ring-2 ring-natural-sage/25" : "border-natural-border bg-white hover:border-natural-sage/45"}`}><AnimalAvatar id={item.id} className="h-9 w-9 rounded-xl" /><span className="mt-1 font-sans text-[9px] font-bold text-natural-stone">{item.label}</span>{item.id === avatar && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-natural-sage" />}</button>)}</div></fieldset>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}{saved && <p className="inline-flex items-center gap-1.5 text-xs font-bold text-natural-sage"><Check className="h-4 w-4" /> Profile saved</p>}
      <button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-natural-sage px-4 font-sans text-xs font-bold text-white hover:bg-natural-sage-dark disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile</button>
    </form>
    <section className="rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-natural-sage/10 text-natural-sage"><UserRound className="h-5 w-5" /></div><div><h2 className="font-sans text-sm font-bold text-natural-dark">Sign-in methods</h2><p className="mt-1 text-xs leading-relaxed text-natural-stone">{identity?.hasPassword ? "Password connected" : "You sign in with Google"}{identity?.googleConnected ? " · Google connected" : ""}</p>{identity?.email && <p className="mt-1 text-xs text-natural-stone">Recovery email: {identity.email}</p>}{!identity?.googleConnected && <button type="button" onClick={() => window.location.assign("/api/auth/google?intent=link")} className="mt-4 min-h-10 rounded-full border border-natural-border px-4 font-sans text-xs font-bold text-natural-dark hover:border-natural-sage/60">Connect Google</button>}{!identity?.email && <p className="mt-3 text-xs leading-relaxed text-natural-stone">Connect Google to add a verified email for password recovery.</p>}</div></div></section>
  </main>;
}
