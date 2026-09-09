export type HelpTopicId = "getting-started" | "companions" | "returns" | "podcast" | "library-search" | "privacy-sharing" | "troubleshooting";
export type HelpQuestion = { id: string; question: string; answer: string; keywords: readonly string[] };
export type HelpTopic = { id: HelpTopicId; eyebrow: string; title: string; intro: string; questions: readonly HelpQuestion[] };

export const helpTopics: readonly HelpTopic[] = [
  { id: "getting-started", eyebrow: "Reading", title: "Start with one saved session", intro: "Chapter keeps progress and reflection separate, so reading can stay simple.", questions: [
    { id: "add-book", question: "How do I start?", answer: "Add a book, choose the reading experience that fits it, then use Read now when you are ready. Chapter saves your progress before companion notes begin preparing.", keywords: ["add", "book", "read now", "session"] },
    { id: "rounds", question: "What are reading rounds?", answer: "EPUB sessions use chunks and PDF sessions use pages. Starting a re-read creates a new reading round, so prior progress and companion context remain distinct.", keywords: ["epub", "pdf", "chunks", "pages", "reread"] },
  ] },
  { id: "companions", eyebrow: "Companions", title: "Notes grounded in what you saved", intro: "Companion work happens after a reading session is safely saved.", questions: [
    { id: "states", question: "Why is a companion preparing?", answer: "A saved session appears first. Reading Lens, AI Reader, and Story Thread may then prepare in the background. A ready result is shown when it is complete; a failed result offers the relevant retry action.", keywords: ["preparing", "ready", "failed", "retry"] },
    { id: "story-boundary", question: "How does Story Thread avoid spoilers?", answer: "Story Thread and Character Memory use saved sessions from the selected reading round only. They do not use unread text or silently move between reading rounds.", keywords: ["story", "character", "spoiler", "round"] },
    { id: "ai-reader", question: "What does AI Reader use?", answer: "AI Reader and Book Wiki synthesize saved companion analysis. They are available only after eligible saved reading sessions have been processed.", keywords: ["ai reader", "book wiki", "analysis"] },
  ] },
  { id: "returns", eyebrow: "Return", title: "Come back to the source", intro: "A useful line is more valuable when you can find where it came from.", questions: [
    { id: "saved-memory", question: "How are quotes, notes, and markers saved?", answer: "Quotes, notes, and markers stay connected to the saved reading session where they were created, including its page or chunk context.", keywords: ["quote", "note", "marker", "saved"] },
    { id: "revisit", question: "What does Revisit open?", answer: "Returns opens the exact source session and reading round for that reflection, then highlights that saved session so you can reconnect it to the book.", keywords: ["revisit", "exact", "source", "session", "round"] },
  ] },
  { id: "podcast", eyebrow: "Listen", title: "Podcasts follow your reading round", intro: "Listening stays optional and is prepared chapter by chapter.", questions: [
    { id: "eligibility", question: "Which books support podcasts?", answer: "Podcast currently supports EPUB books only. A source section can also be unavailable when it is too brief for a meaningful episode.", keywords: ["epub", "eligible", "unavailable", "brief"] },
    { id: "narrator", question: "How does narrator choice work?", answer: "Choose a narrator when creating the first episode for a book and reading round. That voice stays with that round; a future re-read can choose again.", keywords: ["narrator", "voice", "reread", "episode"] },
    { id: "podcast-status", question: "Why is an episode preparing or failed?", answer: "Episodes can be preparing, ready, unavailable, or failed. A failed eligible episode can be tried again without changing your reading progress.", keywords: ["preparing", "failed", "try again", "ready"] },
  ] },
  { id: "library-search", eyebrow: "Library", title: "Find a saved memory again", intro: "Search is fast, owner-scoped, and leads back to its evidence when available.", questions: [
    { id: "what-searches", question: "What does Library Search find?", answer: "It finds books, AI Reader and Book Wiki ideas, quotes, notes, reflections, and story material that has been saved or derived for your library.", keywords: ["ideas", "quotes", "notes", "reflection", "story"] },
    { id: "source-navigation", question: "Why does a result open a reading session?", answer: "A result backed by a saved session opens its exact source session and reading round, rather than stopping at the book cover.", keywords: ["source", "session", "round", "result"] },
    { id: "raw-text", question: "Does search read all uploaded text?", answer: "No. Library Search does not index raw reading text. It searches the saved and derived memories listed above.", keywords: ["raw", "text", "privacy", "index"] },
  ] },
  { id: "privacy-sharing", eyebrow: "Privacy", title: "Your source material stays yours", intro: "Sharing a book does not turn private reading material into shared workspace data.", questions: [
    { id: "raw-private", question: "Who can see raw session text?", answer: "Raw saved session text remains private to the book owner. Companion features use saved material to ground their output.", keywords: ["raw", "private", "source", "owner"] },
    { id: "shared", question: "What can shared readers do?", answer: "Shared readers can view intentionally available book information and content. They cannot mutate private notes or create owner-only companion work.", keywords: ["shared", "read-only", "notes", "owner"] },
  ] },
  { id: "troubleshooting", eyebrow: "Help", title: "When something is not ready yet", intro: "Most states explain whether to wait, retry, or adjust the current book.", questions: [
    { id: "retry", question: "When can I retry?", answer: "Retry is available only after a feature reports a terminal failure. While work is preparing, let that specific session or episode finish before trying again.", keywords: ["retry", "failure", "preparing"] },
    { id: "missing-search", question: "Why is a search result missing?", answer: "Search can only find a saved or derived item after it exists. It does not search raw reading text, and a very new companion result may still be preparing.", keywords: ["search", "missing", "preparing", "raw"] },
    { id: "account", question: "Where do I manage delivery or membership?", answer: "Use Account for Telegram daily delivery, membership status, and payment history. Feature availability is shown where you use that feature.", keywords: ["account", "telegram", "membership", "payment"] },
  ] },
];

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
export function filterHelpTopics(topics: readonly HelpTopic[], query: string): readonly HelpTopic[] {
  const needle = normalize(query);
  if (!needle) return topics;
  return topics.filter((topic) => normalize([topic.title, topic.intro, topic.eyebrow, ...topic.questions.flatMap((question) => [question.question, question.answer, ...question.keywords])].join(" ")).includes(needle));
}
