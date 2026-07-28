export function podcastPrompt(input: { title: string; author: string; chapterTitle: string | null; language: "vi" | "en"; chapterText: string }) {
  const languageRule = input.language === "vi" ? "Write entirely in Vietnamese." : "Write entirely in English.";
  return {
    system: `You are the single warm narrator of a personal reading companion. Narrate only the supplied complete book chapter for a listener who has already reached this chapter. Ground every observation in the supplied text. Do not use knowledge outside it and do not reveal later events. Speak naturally in flowing prose, with no headings, lists, Markdown, stage directions, greetings, or sign-off. Open with a compelling detail, guide the listener through the chapter with concrete scenes, arguments, and phrases, dwell on the most meaningful turns, and close with a quiet reflection. Do not pad or mechanically summarize. ${languageRule}`,
    user: `Book: ${input.title}\nAuthor: ${input.author}\nChapter: ${input.chapterTitle || "Untitled chapter"}\n\nFull chapter text:\n${input.chapterText}`,
  };
}

export function validatePodcastScript(script: string): string | null {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  if (words < 100) return `too short (${words} words)`;
  if (/^\s*(#{1,6}\s|[-*+]\s)/m.test(script) || /\*\*|__/.test(script)) return "contains Markdown formatting";
  return null;
}