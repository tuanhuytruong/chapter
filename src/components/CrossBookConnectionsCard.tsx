import { useState } from "react";
import { GitFork, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api, type CrossBookConnectionsResponse } from "../api";

export default function CrossBookConnectionsCard({ data, onRefresh }: { data: CrossBookConnectionsResponse; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generate = async () => {
    setBusy(true); setError("");
    try { await api.generateCrossBookConnections(`cross-book:${crypto.randomUUID()}`); await onRefresh(); }
    catch (e) { setError(e instanceof Error ? "Could not create connections right now." : "Could not create connections right now."); }
    finally { setBusy(false); }
  };
  const connection = data.connection;
  return <section className="bg-natural-cream border border-natural-border rounded-2xl p-5 shadow-sm space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div><h3 className="flex items-center gap-1.5 font-bold text-sm text-natural-dark"><GitFork className="w-4 h-4 text-natural-sage" /> Cross-book Connections</h3><p className="text-xs text-natural-stone mt-1">Find grounded threads that travel across your reading.</p></div>
      {data.available && data.hasSource && <button disabled={busy} onClick={generate} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-natural-sage text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-60">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : connection ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}{connection ? "Refresh" : "Connect"}</button>}
    </div>
    {!data.available ? <p className="text-xs text-natural-stone">Available with Deep Reader.</p> : !data.hasSource ? <p className="text-xs text-natural-stone">Add grounded reading notes from at least two books to unlock connections.</p> : connection ? <>
      <p className="text-sm text-natural-dark leading-relaxed">{connection.opening}</p>
      <div className="space-y-3">{connection.connections.map((item, index) => <article key={`${item.title}-${index}`} className="border-l-2 border-natural-sage/50 pl-3"><h4 className="font-bold text-xs text-natural-dark">{item.title}</h4><p className="text-xs leading-relaxed text-natural-stone mt-1">{item.synthesis}</p><p className="text-[10px] text-natural-sage mt-2">{Array.from(new Set(item.sourceRefs.map(ref => ref.bookTitle))).join(" · ")}</p></article>)}</div>
      {connection.carryForward.length > 0 && <div className="pt-2 border-t border-natural-border"><p className="text-[10px] font-bold uppercase tracking-wider text-natural-stone">Carry forward</p>{connection.carryForward.map((item, index) => <p key={index} className="text-xs text-natural-dark mt-1">• {item}</p>)}</div>}
    </> : <p className="text-xs text-natural-stone">Your saved reading evidence is ready to connect.</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </section>;
}
