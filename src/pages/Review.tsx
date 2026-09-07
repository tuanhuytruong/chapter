import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, type ReturnCard as ReturnCardData } from "../api";
import type { ReturnOutcome } from "../review";
import ReviewHeader from "../components/review/ReviewHeader";
import ReturnCard from "../components/review/ReturnCard";
import ReviewEmptyState from "../components/review/ReviewEmptyState";
import { captureAnalyticsEvent } from "../analytics";
import { notifyReviewsChanged } from "../reviewEvents";

export default function Review() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<ReturnCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responded, setResponded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCards(await api.getReturns("page"));
    } catch (cause: any) {
      setError(cause.message || "Could not load your returns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const card = cards[0];
  useEffect(() => {
    if (card) captureAnalyticsEvent("return_shown", { surface: "page" });
  }, [card?.id]);

  const respond = useCallback(async (outcome: ReturnOutcome, reflection?: string) => {
    const card = cards[0];
    if (!card || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.respondToReturn(card.id, { outcome, ...(reflection?.trim() ? { reflection } : {}) });
      captureAnalyticsEvent("return_responded", { surface: "page", outcome });
      notifyReviewsChanged();
      setResponded(true);
      if (outcome === "revisit") {
        navigate(`/books/${card.book_id}`);
        return;
      }
      setCards((current) => current.slice(1));
    } catch (cause: any) {
      setError(cause.message || "Could not save this return. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [cards, navigate, saving]);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin text-natural-sage" /></div>;

  return <main className="mx-auto max-w-2xl space-y-5 px-4 font-sans sm:px-0">
    <ReviewHeader />
    {card ? <>
      <ReturnCard card={card} saving={saving} onRespond={(outcome, reflection) => void respond(outcome, reflection)} onSourceOpen={() => captureAnalyticsEvent("return_source_opened", { surface: "page" })} />
      {error && <p role="alert" className="text-center text-xs text-red-700">{error}</p>}
    </> : <>
      <ReviewEmptyState responded={responded} />
      {error && <p role="alert" className="text-center text-xs text-red-700">{error}</p>}
    </>}
  </main>;
}
