export const RENDERER_VERSION = 2;
export const escapeHtml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function renderSummary(title: string, author: string, log: any, origin: string): string[] {
  const url = new URL(`/books/${encodeURIComponent(log.book_id)}`, origin);
  if (url.protocol !== 'https:') throw new Error('HTTPS_ORIGIN_REQUIRED');
  const text = [`📖 ${title} — ${author}`, `${String(log.date).slice(0,10)} · Round ${log.reading_round} · Session ${log.session}`, `Trang ${log.page_start}–${log.page_end}`, log.summary, ...(log.key_insights || []).map((x: string) => `• ${x}`), log.quote, url.href].filter(Boolean).join('\n\n');
  const segments = new Intl.Segmenter('und', {granularity: 'grapheme'}).segment(text);
  const chunks: string[] = []; let chunk = '';
  // Reserve header space even for very large multipart messages. Do not bisect graphemes.
  for (const {segment} of segments) {
    if (segment.length > 3400) throw new Error('GRAPHEME_TOO_LONG');
    if (chunk.length + segment.length > 3400) { chunks.push(chunk); chunk = ''; }
    chunk += segment;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((s,i) => `<b>Chapter · ${i+1}/${chunks.length}</b>\n${escapeHtml(s)}`);
}
export const plainText = (html: string) => html.replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
