import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { api, type FeedbackBrowser, type FeedbackKind, type FeedbackPlatform } from "../api";
import { captureAnalyticsEvent } from "../analytics";
import PageHeader from "../components/PageHeader";

const options: Array<{ value: FeedbackKind; label: string; hint: string; placeholder: string }> = [
  { value: "bug", label: "Report a bug", hint: "Something did not work as expected.", placeholder: "What happened, what did you expect, and what page or action led to it?" },
  { value: "idea", label: "Suggest an improvement", hint: "A reading moment Chapter could support better.", placeholder: "What problem or reading moment would this improvement help with?" },
  { value: "other", label: "Something else", hint: "A concise note for the Chapter team.", placeholder: "Write your feedback here." },
];

function clientPlatform(): FeedbackPlatform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "web_android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "web_ios";
  return "web_desktop";
}

function browserFamily(): FeedbackBrowser {
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "edge";
  if (/Firefox\//i.test(ua)) return "firefox";
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua)) return "safari";
  return "other";
}

function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text.startsWith("429:")) return "You have sent enough feedback for today. Please try again tomorrow.";
  if (text.startsWith("400:")) {
    try { return JSON.parse(text.slice(4)).error || "Please check your feedback and try again."; } catch { return "Please check your feedback and try again."; }
  }
  return "We could not send your feedback. Your message is still here — please try again.";
}

export default function Feedback() {
  const location = useLocation();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);
  const selected = options.find((option) => option.value === kind)!;

  useEffect(() => { if (submitted) successRef.current?.focus(); }, [submitted]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.replace(/\r\n?/g, "\n").trim();
    if (trimmed.length < 10) { setError("Please add a little more detail before sending."); return; }
    setBusy(true); setError(null);
    try {
      await api.submitFeedback({ kind, message: trimmed, routePath: location.pathname, clientPlatform: clientPlatform(), browserFamily: browserFamily() });
      captureAnalyticsEvent("feedback_submitted", { kind });
      setSubmitted(true);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  if (submitted) return <main className="mx-auto max-w-2xl"><section className="rounded-3xl border border-natural-sage/30 bg-natural-sage/10 p-6 shadow-sm sm:p-8" role="status"><CheckCircle2 className="h-8 w-8 text-natural-sage" /><h1 ref={successRef} tabIndex={-1} className="mt-4 text-3xl font-bold text-natural-dark outline-none">Thank you</h1><p className="mt-2 max-w-lg text-sm leading-relaxed text-natural-stone">Your feedback helps shape Chapter. We may not reply individually.</p><Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-natural-sage px-4 text-xs font-bold text-white hover:bg-natural-sage-dark">Back to reading</Link></section></main>;

  return <main className="mx-auto max-w-2xl space-y-5"><PageHeader eyebrow="Feedback" title="Help shape Chapter" description="Share a concise note about your experience. We may not reply individually." titleClassName="mt-1 text-3xl font-bold" descriptionClassName="mt-2 text-sm text-natural-stone" /><form onSubmit={submit} className="space-y-6 rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6"><fieldset><legend className="text-sm font-bold text-natural-dark">What would you like to share?</legend><div className="mt-3 grid gap-2 sm:grid-cols-3">{options.map((option) => <label key={option.value} className={`cursor-pointer rounded-2xl border p-3 transition ${kind === option.value ? "border-natural-sage bg-natural-sage/10 ring-2 ring-natural-sage/20" : "border-natural-border bg-white hover:border-natural-sage/50"}`}><input type="radio" name="feedback-kind" value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} className="sr-only" /><span className="block text-sm font-bold text-natural-dark">{option.label}</span><span className="mt-1 block text-xs leading-relaxed text-natural-stone">{option.hint}</span></label>)}</div></fieldset><label className="block"><span className="text-sm font-bold text-natural-dark">Your feedback</span><textarea value={message} onChange={(event) => { setMessage(event.target.value.slice(0, 2000)); if (error) setError(null); }} required minLength={10} maxLength={2000} rows={7} placeholder={selected.placeholder} className="mt-2 block w-full rounded-2xl border border-natural-border bg-white px-3 py-3 text-sm leading-relaxed text-natural-dark outline-none placeholder:text-natural-stone/75 focus:border-natural-sage focus:ring-2 focus:ring-natural-sage/20" /><span className="mt-2 block text-right text-xs text-natural-stone">{message.length} / 2,000</span></label><details className="rounded-2xl border border-natural-border bg-white px-4 py-3"><summary className="cursor-pointer text-xs font-bold text-natural-dark">What we include to help investigate</summary><p className="mt-2 text-xs leading-relaxed text-natural-stone">This page and a broad browser/device category. We never automatically attach your book, notes, or reading text.</p></details><p className="rounded-2xl border border-natural-clay/25 bg-natural-clay/5 px-4 py-3 text-xs leading-relaxed text-natural-dark"><strong>Please do not include</strong> book passages, notes, passwords, or other sensitive information.</p>{error && <p role="alert" aria-live="assertive" className="text-sm text-red-700">{error}</p>}<button type="submit" disabled={busy || message.trim().length < 10} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-natural-sage px-5 text-xs font-bold text-white hover:bg-natural-sage-dark disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy ? "Sending…" : "Send feedback"}</button></form></main>;
}
