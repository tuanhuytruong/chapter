import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export type GlossaryLanguage = "vi" | "en";
export type GlossaryKey = "Deepened" | "Shifted" | "Introduced" | "Resolved" | "Uncertain" | "Open" | "Escalating" | "Claim" | "Support" | "Evidence" | "Example" | "Implication" | "Implied";
const TERMS: Record<GlossaryKey, { en: string; vi: string; enDetail: string; viDetail: string }> = {
  Deepened: { en: "Deepened", vi: "Đào sâu", enDetail: "The reading develops this idea with more nuance or detail.", viDetail: "Phần đọc phát triển ý này với thêm sắc thái hoặc chi tiết." },
  Shifted: { en: "Shifted", vi: "Đã chuyển hướng", enDetail: "The emphasis or meaning changes as the reading progresses.", viDetail: "Trọng tâm hoặc ý nghĩa thay đổi khi phần đọc tiếp diễn." },
  Introduced: { en: "Introduced", vi: "Mới xuất hiện", enDetail: "This idea, person, or thread appears here for the first time.", viDetail: "Ý tưởng, nhân vật hoặc mạch này xuất hiện lần đầu ở đây." },
  Resolved: { en: "Resolved", vi: "Đã được giải quyết", enDetail: "The reading gives enough information to close or settle this thread.", viDetail: "Phần đọc cung cấp đủ thông tin để khép lại mạch này." },
  Uncertain: { en: "Uncertain", vi: "Chưa chắc chắn", enDetail: "The available reading does not establish this clearly yet.", viDetail: "Phần đọc hiện có chưa xác lập điều này một cách rõ ràng." },
  Open: { en: "Open", vi: "Đang mở", enDetail: "This thread has not reached a settled outcome in the reading yet.", viDetail: "Mạch này chưa có kết cục rõ ràng trong phần đọc." },
  Escalating: { en: "Escalating", vi: "Đang leo thang", enDetail: "The tension, stakes, or consequences of this thread are increasing.", viDetail: "Căng thẳng, mức độ quan trọng hoặc hệ quả của mạch này đang gia tăng." },
  Claim: { en: "Claim", vi: "Luận điểm", enDetail: "The main idea or assertion being made.", viDetail: "Ý chính hoặc điều đang được khẳng định." },
  Support: { en: "Support", vi: "Cơ sở", enDetail: "The reasoning or material that backs up a claim.", viDetail: "Lập luận hoặc chất liệu làm cơ sở cho luận điểm." },
  Evidence: { en: "Evidence", vi: "Bằng chứng", enDetail: "A detail from the saved reading that grounds an observation.", viDetail: "Chi tiết từ phần đọc đã lưu làm nền cho nhận xét." },
  Example: { en: "Example", vi: "Ví dụ", enDetail: "A concrete instance that makes an idea easier to see.", viDetail: "Một trường hợp cụ thể giúp làm rõ ý tưởng." },
  Implication: { en: "Implication", vi: "Hệ quả", enDetail: "What may follow from the idea, without adding outside facts.", viDetail: "Điều có thể suy ra từ ý tưởng, không thêm dữ kiện bên ngoài." },
  Implied: { en: "Implied", vi: "Hàm ý", enDetail: "Suggested by the reading, but not stated directly.", viDetail: "Được gợi ra trong phần đọc nhưng không nói trực tiếp." },
};
export function GlossaryTerm({ term, language = "en", children }: { term: GlossaryKey; language?: GlossaryLanguage; children?: ReactNode }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLSpanElement>(null); const copy = TERMS[term];
  useEffect(() => { if (!open) return; const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); const outside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("keydown", key); document.addEventListener("mousedown", outside); return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", outside); }; }, [open]);
  return <span ref={ref} className="relative inline-flex items-center gap-1"><button type="button" aria-expanded={open} aria-label={`${copy[language]}: ${copy[language === "vi" ? "viDetail" : "enDetail"]}`} onClick={() => setOpen(v => !v)} className="border-b border-dotted border-natural-sage/70 font-semibold text-natural-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50">{children || copy[language]}</button>{open && <span role="dialog" className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-natural-border bg-natural-cream p-3 text-left text-[11px] font-normal leading-relaxed text-natural-dark shadow-lg"><strong className="block text-xs">{copy[language]}</strong>{copy[language === "vi" ? "viDetail" : "enDetail"]}<span className="mt-2 block text-[10px] text-natural-stone">{language === "vi" ? "Nhấn Escape để đóng" : "Press Escape to close"}</span></span>}<Info aria-hidden="true" className="h-3 w-3 text-natural-sage" /></span>;
}
export function GlossaryLabel({ term, language = "en" }: { term: GlossaryKey; language?: GlossaryLanguage }) { return <GlossaryTerm term={term} language={language} />; }
