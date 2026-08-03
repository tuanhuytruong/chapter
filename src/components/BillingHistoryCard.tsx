import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { api, type BillingMeResponse } from "../api";

function money(value: number) { return `${new Intl.NumberFormat("vi-VN").format(value)} VNĐ`; }
function when(value: string | null | undefined) { return value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function statusLabel(status: string) {
  return status === "paid" ? "Confirmed" : status === "expired" ? "Expired" : "Awaiting transfer";
}

export default function BillingHistoryCard() {
  const [data, setData] = useState<BillingMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.getBillingMe()); }
    catch { setError("Could not load payment history right now."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const copy = async (text: string) => { await navigator.clipboard?.writeText(text); };
  return <section className="rounded-3xl border border-natural-border bg-natural-cream p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-natural-sage">Membership payments</p><h2 className="mt-1 text-sm font-bold text-natural-dark">Transfer status & history</h2></div><button onClick={() => void load()} disabled={loading} aria-label="Refresh payment history" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-natural-border text-natural-stone disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
    {loading && !data && <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-natural-sage" /></div>}
    {error && <p className="mt-4 rounded-2xl bg-white p-3 text-xs text-natural-stone">{error}</p>}
    {data && data.orders.length === 0 && <p className="mt-4 text-xs leading-relaxed text-natural-stone">No bank-transfer orders yet. Your reading remains free unless you choose to upgrade.</p>}
    {data && data.orders.length > 0 && <div className="mt-4 space-y-3">{data.orders.map(order => <article key={order.id} className="rounded-2xl border border-natural-border bg-white/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-natural-dark">{money(order.amountVnd)} · {order.tier.replace(/_/g, " ")}</p><span className="rounded-full bg-natural-sage/10 px-2 py-1 text-[10px] font-bold text-natural-sage">{statusLabel(order.status)}</span></div><p className="mt-2 text-xs text-natural-stone">Created {when(order.createdAt)}{order.status === "pending" ? ` · expires ${when(order.expiresAt)}` : ""}</p>{order.status === "pending" && <><p className="mt-3 text-xs text-natural-stone">Transfer content — use this exact value. Your plan changes only after manual payment matching.</p><button onClick={() => void copy(order.transferReference)} className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-natural-border px-3 font-mono text-xs text-natural-dark"><span>{order.transferReference}</span><Copy className="h-4 w-4" /></button>{order.qrUrl && <img src={order.qrUrl} alt="MB VietQR payment code" className="mt-3 w-40 rounded-xl border border-natural-border bg-white p-2" />}</>}</article>)}</div>}
  </section>;
}
