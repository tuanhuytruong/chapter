import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export type GlossaryLanguage = "vi" | "en";
export type GlossaryLanguageSetting = GlossaryLanguage | "auto";
export type GlossaryKey = "Deepened" | "Shifted" | "Introduced" | "Resolved" | "Uncertain" | "Open" | "Escalating" | "Claim" | "Support" | "Evidence" | "Example" | "Implication" | "Implied" | "ArgumentMap" | "AssumptionsLimits" | "KeyConcepts" | "QuestionsForward" | "ReadingNotes" | "ReadingLens" | "Consistency" | "Velocity" | "Momentum" | "Slipping" | "Steady" | "OnFire" | "Pace" | "Streak";

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
  ArgumentMap: { en: "Argument map", vi: "Sơ đồ lập luận", enDetail: "How the claim, its support, and its implications fit together.", viDetail: "Cách luận điểm, cơ sở và hệ quả của nó khớp với nhau." },
  AssumptionsLimits: { en: "Assumptions & limits", vi: "Giả định & giới hạn", enDetail: "What the reading takes for granted and where it stops short.", viDetail: "Điều phần đọc xem là hiển nhiên và chỗ nó còn hạn chế." },
  KeyConcepts: { en: "Key concepts", vi: "Khái niệm chính", enDetail: "Terms the reading relies on and what they mean here.", viDetail: "Các thuật ngữ phần đọc dựa vào và ý nghĩa của chúng ở đây." },
  QuestionsForward: { en: "Questions to carry forward", vi: "Câu hỏi để ngỏ", enDetail: "Open questions the reading leaves worth returning to.", viDetail: "Các câu hỏi mở mà phần đọc để lại, đáng quay lại suy ngẫm." },
  ReadingNotes: { en: "Reading notes", vi: "Ghi chú đọc", enDetail: "The analyst's caution notes about this analysis.", viDetail: "Các lưu ý thận trọng của phân tích này." },
  ReadingLens: { en: "Reading Lens", vi: "Lăng kính đọc", enDetail: "A structured analysis of a saved reading session.", viDetail: "Phân tích có cấu trúc của một phiên đọc đã lưu." },
  Consistency: { en: "Consistency", vi: "Đều đặn", enDetail: "How regularly you read: pages read versus your daily chunks target over the last 7 days.", viDetail: "Mức đều đặn: % trang đọc được so với mục tiêu chunks/day trong 7 ngày gần nhất." },
  Velocity: { en: "Velocity", vi: "Nhịp độ", enDetail: "Your recent pace vs your usual pace: reading days in the last 7 compared with the last 14.", viDetail: "Nhịp độ: số ngày đọc trong 7 ngày gần so với 14 ngày — mức tham gia hiện tại so với thói quen chung." },
  Momentum: { en: "Momentum", vi: "Động lực", enDetail: "A 0–100 score blending Consistency (55%), Velocity (30%) and a bonus for multi-session days.", viDetail: "Điểm động lực 0–100: Consistency ×0.55 + Velocity ×0.3 + bonus cho ngày đọc nhiều phiên." },
  Slipping: { en: "Slipping", vi: "Đang chững lại", enDetail: "Reading over the last 3 days dropped below 80% of the previous 3 days.", viDetail: "Lượng đọc 3 ngày gần nhất giảm dưới 80% so với 3 ngày trước đó." },
  Steady: { en: "Steady", vi: "Ổn định", enDetail: "Recent reading is close to your previous pace — the habit holds.", viDetail: "Lượng đọc 3 ngày gần nhất tương đương 3 ngày trước — thói quen được giữ vững." },
  OnFire: { en: "On fire", vi: "Bùng cháy", enDetail: "Reading over the last 3 days is more than 120% of the previous 3 days.", viDetail: "Lượng đọc 3 ngày gần nhất tăng hơn 120% so với 3 ngày trước đó." },
  Pace: { en: "Pace", vi: "Tiến độ", enDetail: "Estimated days left to finish = remaining chunks ÷ chunks per day.", viDetail: "Ước tính số ngày còn lại để hết sách = chunks còn lại ÷ chunks mỗi ngày." },
  Streak: { en: "Streak", vi: "Chuỗi ngày", enDetail: "Consecutive days with at least one reading session.", viDetail: "Số ngày liên tiếp có ít nhất một phiên đọc." },
};

export function resolveGlossaryLanguage(setting: GlossaryLanguageSetting, sourceText = ""): GlossaryLanguage {
  if (setting === "vi" || setting === "en") return setting;
  const vietnameseSignals = (sourceText.match(/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi) || []).length;
  return vietnameseSignals > 0 ? "vi" : "en";
}

export function GlossaryTerm({ term, language = "en", children }: { term: GlossaryKey; language?: GlossaryLanguage; children?: ReactNode }) {
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const copy = TERMS[term];
  const detail = copy[language === "vi" ? "viDetail" : "enDetail"];
  const open = pinnedOpen || hoverOpen;
  const popupId = `glossary-${term.toLowerCase()}`;

  useEffect(() => {
    if (!pinnedOpen) return;
    const key = (event: KeyboardEvent) => event.key === "Escape" && setPinnedOpen(false);
    const outside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setPinnedOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", outside);
    };
  }, [pinnedOpen]);

  return <span
    ref={ref}
    className="relative inline-flex items-center"
    onPointerEnter={() => setHoverOpen(true)}
    onPointerLeave={() => setHoverOpen(false)}
  >
    <button
      type="button"
      aria-expanded={open}
      aria-controls={popupId}
      aria-label={`${copy.en}: ${detail}`}
      onClick={() => setPinnedOpen((value) => !value)}
      onFocus={() => setHoverOpen(true)}
      onBlur={() => setHoverOpen(false)}
      onPointerEnter={() => setHoverOpen(true)}
      onPointerLeave={() => setHoverOpen(false)}
      className="inline-flex items-center gap-1 border-b border-dotted border-current font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50"
    >
      {/* The visible label stays in English (the source language of the
          product); only the popup explanation follows the glossary language. */}
      {children || copy.en}
      <Info aria-hidden="true" className="h-3 w-3 shrink-0" />
    </button>
    {open && <span id={popupId} role="tooltip" className="absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-lg border border-natural-border bg-natural-cream px-2.5 py-2 text-left text-[10px] font-normal normal-case leading-snug tracking-normal text-natural-dark shadow-lg">
      <strong className="block text-xs">{copy[language]}</strong>
      {detail}
      {pinnedOpen && <span className="mt-2 block text-[10px] text-natural-stone">{language === "vi" ? "Nhấn Escape để đóng" : "Press Escape to close"}</span>}
    </span>}
  </span>;
}

export function GlossaryLabel({ term, language = "en" }: { term: GlossaryKey; language?: GlossaryLanguage }) {
  return <GlossaryTerm term={term} language={language} />;
}
