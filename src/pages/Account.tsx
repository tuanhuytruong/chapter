import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Send, Unplug } from "lucide-react";
import { OnboardingHelp } from "../onboarding";
import { api, type EntitlementsResponse } from "../api";
import MembershipStatusCard from "../components/MembershipStatusCard";
import BillingHistoryCard from "../components/BillingHistoryCard";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { getCachedEntitlements } from "../membershipCache";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error((await res.text()) || "Request failed");
  return res.json() as Promise<T>;
}

export default function Account() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementsResponse | null>(null);
  const pollRef = useRef<number | null>(null);
  const load = useCallback(async () => {
    try { setConnected((await request<{ connected: boolean }>("/api/auth/telegram")).connected); }
    catch { setError("Could not load Telegram status."); }
  }, []);
  useEffect(() => { void load(); if (user) void getCachedEntitlements(user.id, api.getEntitlements).then(setEntitlement).catch(() => undefined); return () => { if (pollRef.current) window.clearInterval(pollRef.current); }; }, [load, user?.id]);
  const connect = async () => {
    setBusy(true); setError(null);
    try {
      const { url } = await request<{ url: string }>("/api/auth/telegram/link", { method: "POST" });
      window.open(url, "_blank", "noopener,noreferrer"); setLinking(true);
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(async () => {
        try { const data = await request<{ connected: boolean }>("/api/auth/telegram"); if (data.connected) { setConnected(true); setLinking(false); if (pollRef.current) window.clearInterval(pollRef.current); } } catch { /* retain current state */ }
      }, 2500);
    } catch (e: any) { setError(e.message || "Could not start Telegram link."); }
    finally { setBusy(false); }
  };
  const disconnect = async () => { setBusy(true); setError(null); try { await request("/api/auth/telegram", { method: "DELETE" }); setConnected(false); } catch (e: any) { setError(e.message || "Could not disconnect Telegram."); } finally { setBusy(false); } };
  return <main className="mx-auto max-w-2xl space-y-5"><section><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Settings</p><h1 className="mt-1 text-3xl font-bold">Your reading delivery</h1><p className="mt-2 text-sm text-natural-stone">Connect a private Telegram chat for daily reading summaries.</p></section><section className="rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><div className="flex gap-3"><div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-natural-sage/10 text-natural-sage"><Send className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-sans text-sm font-bold">Telegram daily delivery</h2>{connected === true && <span className="inline-flex items-center gap-1 rounded-full bg-natural-sage/10 px-2 py-1 font-sans text-[10px] font-bold text-natural-sage"><CheckCircle2 className="h-3 w-3" /> Connected</span>}</div><p className="mt-1 text-xs leading-relaxed text-natural-stone">Your chat ID stays private. Chapter sends only your own completed daily summaries.</p>{linking && <p className="mt-3 rounded-xl bg-natural-sage/5 p-3 text-xs text-natural-sage">Open the bot and tap Start. We will connect this page automatically.</p>}{error && <p className="mt-3 text-xs text-red-600">{error}</p>}<div className="mt-4 flex flex-wrap gap-2">{connected ? <button disabled={busy} onClick={disconnect} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-natural-border px-4 font-sans text-xs font-bold text-natural-dark disabled:opacity-50"><Unplug className="h-3.5 w-3.5" /> Disconnect</button> : <button disabled={busy || connected === null} onClick={connect} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-natural-sage px-4 font-sans text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-3.5 w-3.5" /> Connect Telegram</>}</button>}</div></div></div></section>{entitlement && <><MembershipStatusCard data={entitlement} /><Link to="/pricing" className="inline-flex min-h-11 items-center rounded-full border border-natural-border px-4 font-sans text-xs font-bold text-natural-dark hover:bg-natural-cream">Explore membership</Link></>}<BillingHistoryCard /><OnboardingHelp /></main>;
}
