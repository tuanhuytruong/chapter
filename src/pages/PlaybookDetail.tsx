import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api } from "../api";
import { captureAnalyticsEvent } from "../analytics";
import type { ReferenceCard, ReferenceCardDraft, ReferenceCardUse } from "../types";
import FieldsEditor from "../components/playbooks/ReferenceCardFieldsEditor";
import ReferenceCardUseSheet from "../components/playbooks/ReferenceCardUseSheet";

export default function PlaybookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<ReferenceCard | null>(null);
  const [uses, setUses] = useState<ReferenceCardUse[]>([]);
  const [draft, setDraft] = useState<ReferenceCardDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usingCard, setUsingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await api.getPlaybookCard(id);
      setCard(result.card);
      setUses(result.uses);
      setDraft({ cardType: result.card.cardType, title: result.card.title, content: result.card.content, fields: result.card.fields, tags: result.card.tags, sourceExcerpt: result.card.sourceExcerpt, personalAdaptation: result.card.personalAdaptation, needsReview: result.card.needsReview });
      setError(null);
    } catch (e: any) { setError(e.message || "Could not load this card."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]);

  const save = async () => {
    if (!id || !draft) return;
    setSaving(true);
    try {
      const result = await api.updatePlaybookCard(id, draft);
      setCard(result.card);
      setDraft({ ...draft, sourceExcerpt: result.card.sourceExcerpt });
      captureAnalyticsEvent("reference_card_updated", { card_type: result.card.cardType, has_personal_adaptation: Boolean(draft.personalAdaptation?.trim()) });
      setError(null);
    } catch (e: any) { setError(e.message || "Could not save this card."); }
    finally { setSaving(false); }
  };
  const recordUse = async (note: string) => {
    if (!id || !card) return;
    setSaving(true);
    try {
      await api.recordPlaybookUse(id, { requestKey: crypto.randomUUID(), note });
      captureAnalyticsEvent("reference_card_used", { card_type: card.cardType, has_note: Boolean(note) });
      setUsingCard(false);
      await load();
    } catch (e: any) { setError(e.message || "Could not record this use."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!id || !card || !window.confirm(`Delete “${card.title}”? This cannot be undone.`)) return;
    try { await api.deletePlaybookCard(id); captureAnalyticsEvent("reference_card_deleted", { card_type: card.cardType }); navigate("/playbooks"); }
    catch (e: any) { setError(e.message || "Could not delete this card."); }
  };

  if (loading) return <p className="text-sm text-natural-stone">Loading card…</p>;
  if (!card || !draft) return <section className="space-y-3 text-sm text-natural-stone"><p>{error || "This card is unavailable."}</p><Link className="font-bold text-natural-sage underline" to="/playbooks">Back to Playbooks</Link></section>;
  return <div className="mx-auto max-w-3xl space-y-5"><div className="flex items-start justify-between gap-3"><div><Link to="/playbooks" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-natural-sage"><ArrowLeft className="h-4 w-4" /> Playbooks</Link><p className="text-[10px] font-bold uppercase tracking-wider text-natural-sage">{card.cardType}</p><h1 className="text-2xl font-bold text-natural-dark">{card.title}</h1><p className="text-sm text-natural-stone">From {card.book_title} · {card.file_type === "pdf" ? "Pages" : "Chunks"} {card.sourcePageStart}–{card.sourcePageEnd}</p></div><button onClick={remove} className="min-h-11 rounded-full border border-natural-clay/40 px-3 text-xs font-bold text-natural-clay" aria-label="Delete card"><Trash2 className="inline h-4 w-4" /></button></div>{error && <p role="alert" className="rounded-xl border border-natural-clay/40 bg-natural-clay/10 p-3 text-sm text-natural-dark">{error}</p>}<section className="space-y-4 rounded-3xl border border-natural-border bg-natural-cream p-5"><label className="block text-xs font-bold text-natural-stone">Title<input value={draft.title} maxLength={160} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-bg px-3 text-sm text-natural-dark" /></label><label className="block text-xs font-bold text-natural-stone">Summary<textarea rows={3} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} className="mt-1 w-full rounded-xl border border-natural-border bg-natural-bg p-3 text-sm text-natural-dark" /></label><FieldsEditor draft={draft} onChange={setDraft} /><label className="block text-xs font-bold text-natural-stone">Tags <span className="font-normal">(comma-separated)</span><input value={draft.tags.join(", ")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10) })} className="mt-1 min-h-11 w-full rounded-xl border border-natural-border bg-natural-bg px-3 text-sm text-natural-dark" /></label><label className="block text-xs font-bold text-natural-stone">Personal adaptation <span className="font-normal">(kept separate from the book source)</span><textarea rows={3} maxLength={2000} value={draft.personalAdaptation || ""} onChange={(e) => setDraft({ ...draft, personalAdaptation: e.target.value })} className="mt-1 w-full rounded-xl border border-natural-border bg-natural-bg p-3 text-sm text-natural-dark" /></label><details className="rounded-xl border border-natural-border bg-natural-bg p-3"><summary className="cursor-pointer text-xs font-bold text-natural-dark">Source excerpt (read-only)</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-natural-stone">{card.sourceExcerpt}</pre></details><div className="flex flex-wrap gap-2"><button disabled={saving} onClick={save} className="min-h-11 rounded-full bg-natural-sage px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button><button disabled={saving} onClick={() => setUsingCard(true)} className="min-h-11 rounded-full border border-natural-sage px-4 text-xs font-bold text-natural-sage">Mark as used</button></div></section><section className="rounded-3xl border border-natural-border bg-natural-cream p-5"><h2 className="font-bold text-natural-dark">Usage history</h2>{uses.length ? <ul className="mt-3 space-y-2">{uses.map((use) => <li key={use.id} className="border-t border-natural-border pt-2 text-sm text-natural-stone"><time>{new Date(use.used_at).toLocaleDateString()}</time>{use.note && <p className="mt-1 text-natural-dark">{use.note}</p>}</li>)}</ul> : <p className="mt-2 text-sm text-natural-stone">No uses recorded yet.</p>}</section>{usingCard && <ReferenceCardUseSheet card={card} onClose={() => setUsingCard(false)} onSave={recordUse} />}</div>;
}
