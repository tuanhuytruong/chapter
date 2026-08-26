export const NORMAL_PODCAST_MIN_WORDS = 100;
export const SHORT_CHAPTER_SOURCE_WORDS = 180;
export const SHORT_PODCAST_MIN_WORDS = 30;

export function podcastWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function podcastMinimumWords(chapterText: string): number {
  return podcastWordCount(chapterText) < SHORT_CHAPTER_SOURCE_WORDS
    ? SHORT_PODCAST_MIN_WORDS
    : NORMAL_PODCAST_MIN_WORDS;
}

export function podcastPrompt(input: { title: string; author: string; chapterTitle: string | null; language: "vi" | "en"; chapterText: string; minimumWords?: number }) {
  const languageRule = input.language === "vi" ? "Write entirely in Vietnamese." : "Write entirely in English.";
  const compactRule = input.minimumWords === SHORT_PODCAST_MIN_WORDS
    ? "This is a genuinely short chapter: make a compact 30–90 word episode. Stay strictly grounded in the supplied text; do not pad it with inferred context."
    : "Make a substantial episode that gives the chapter room to breathe.";
  return {
    system: `You are the single warm narrator of a personal reading companion. Narrate only the supplied complete book chapter as a standalone episode for a listener who has already reached this chapter. Ground every observation in the supplied text. Do not use knowledge outside it and do not reveal later events. Start directly in an immediate situation, scene, tension, or idea from this supplied chapter. Never refer to the book's front matter, introduction, opening pages, a prior or future episode, or the act of opening, closing, or reading “these pages” unless that material appears in this supplied chapter. Avoid generic meta framing such as “Khi gấp lại những dòng giới thiệu này…”, “ở phần mở đầu…”, “when closing these introductory pages”, or equivalent wording. Speak naturally in flowing prose, with no headings, lists, Markdown, stage directions, greetings, or sign-off. Open with a compelling detail, guide the listener through the chapter with concrete scenes, arguments, and phrases, dwell on the most meaningful turns, and close with a quiet reflection. Do not pad or mechanically summarize. ${compactRule} ${languageRule}`,
    user: `Book: ${input.title}\nAuthor: ${input.author}\nChapter: ${input.chapterTitle || "Untitled chapter"}\n\nFull chapter text:\n${input.chapterText}`,
  };
}

export function validatePodcastScript(script: string, minimumWords = NORMAL_PODCAST_MIN_WORDS): string | null {
  const words = podcastWordCount(script);
  if (words < minimumWords) return `too short (${words} words; minimum ${minimumWords})`;
  if (/^\s*(#{1,6}\s|[-*+]\s)/m.test(script) || /\*\*|__/.test(script)) return "contains Markdown formatting";
  return null;
}