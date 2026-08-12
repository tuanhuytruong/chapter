import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildReadingLensPrompt, parseReadingLensAnalysis, readingLensLanguageValidation } from "../src/readingLens.js";

const source = "Silicon changes power. Evidence stays close to the text.";
const valid = JSON.stringify({
  coreArgument: "Silicon changes power.",
  argumentMap: [{ claim: "Silicon changes power.", support: "Evidence stays close to the text.", implication: "Technology matters." }],
  assumptionsAndLimits: ["Not established in this reading."],
  keyConcepts: [{ term: "Silicon", definition: "A contextual term." }],
  questionsToCarryForward: ["What changes next?"],
  durableInsights: ["Read claims with their support."],
  quote: "Silicon changes power.",
  confidenceNotes: [],
});
const parsed = parseReadingLensAnalysis(valid, source);
assert.equal(parsed.quote, "Silicon changes power.");
assert.equal(parsed.durableInsights.length, 1);
const fenced = parseReadingLensAnalysis(`\`\`\`json\n${valid}\n\`\`\``, source);
assert.equal(fenced.coreArgument, "Silicon changes power.");
const rawNewline = parseReadingLensAnalysis(valid.replace("Silicon changes power.", "Silicon changes\npower."), source);
assert.equal(rawNewline.coreArgument, "Silicon changes power.");
const invalidQuote = parseReadingLensAnalysis(valid.replace("Silicon changes power.\",\"confidence", "Invented quote.\",\"confidence"), source);
assert.equal(invalidQuote.quote, null);
assert.ok(invalidQuote.confidenceNotes.length > 0);
assert.throws(() => parseReadingLensAnalysis("not json", source));

const vietnameseSource = "Người quản lý cần xây dựng niềm tin với nhân viên và dành thời gian cho các cuộc đối thoại chân thành.";
const vietnameseLens = parseReadingLensAnalysis(JSON.stringify({
  coreArgument: "Người quản lý xây dựng niềm tin bằng sự quan tâm và đối thoại chân thành.",
  argumentMap: [{ claim: "Niềm tin giúp nhân viên chia sẻ.", support: "Cuộc đối thoại tạo sự an toàn.", implication: "Quản lý cần lắng nghe." }],
  assumptionsAndLimits: ["Đoạn đọc không nêu mọi hoàn cảnh."],
  keyConcepts: [{ term: "Niềm tin", definition: "Cảm giác an toàn trong quan hệ làm việc." }],
  questionsToCarryForward: ["Làm sao để lắng nghe tốt hơn?"],
  durableInsights: ["Sự quan tâm tạo điều kiện cho đối thoại."],
  quote: null,
  confidenceNotes: ["Phân tích chỉ dựa trên đoạn đọc."],
}), vietnameseSource);
const autoVietnamesePrompt = buildReadingLensPrompt({ title: "Sách", author: "Tác giả", start: 1, end: 2, total: 10, lang: "auto", sourceText: vietnameseSource });
const autoEnglishPrompt = buildReadingLensPrompt({ title: "Book", author: "Author", start: 1, end: 2, total: 10, lang: "auto", sourceText: source });
assert.equal(autoVietnamesePrompt.effectiveLang, "vi");
assert.match(autoVietnamesePrompt.system, /Every non-quote JSON value must be Vietnamese/);
assert.equal(autoEnglishPrompt.effectiveLang, "en");
assert.match(autoEnglishPrompt.system, /Every non-quote JSON value must be English/);
assert.equal(readingLensLanguageValidation(vietnameseLens, autoVietnamesePrompt.effectiveLang).valid, true);
assert.equal(readingLensLanguageValidation(parsed, autoVietnamesePrompt.effectiveLang).valid, false);

const lensCardSource = readFileSync(new URL("../src/components/ReadingLensCard.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
const booksRouteSource = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");

// Slice between the shared list route and the per-log route; route bodies are
// reformatted across lines, so anchor on the quoted path strings themselves.
const sharedLensStart = booksRouteSource.indexOf('"/:id/reading-lens"');
const sharedLensEnd = booksRouteSource.indexOf('"/:id/logs/:logId/reading-lens"', sharedLensStart);
const sharedLensRoute = booksRouteSource.slice(sharedLensStart, sharedLensEnd);
assert.doesNotMatch(sharedLensRoute, /owner_id/, "Persisted Reading Lens data must be readable by all authenticated readers");

// Non-owners must load persisted Reading Lens data into Book Detail.
assert.match(detailSource, /setLenses\(await api\.getReadingLens\(id, selected\)\)/, "Persisted Reading Lens data must load into Book Detail for the selected round");
const sharedLoadStart = detailSource.indexOf("// Persisted companion data is shared read-only.");
const sharedLoadEnd = detailSource.indexOf("} catch (e: any) {", sharedLoadStart);
assert.doesNotMatch(detailSource.slice(sharedLoadStart, sharedLoadEnd), /b\.can_edit/, "Loading shared Reading Lens data must not be owner-gated in Book Detail");

// Regeneration must remain owner-only (multi-line route body).
assert.match(booksRouteSource, /reading-lens\/retry",\s*async \(req: Request, res: Response\) => \{\s*const \{ id, logId \} = req\.params;\s*if \(!\(?await\s+ownerCanMutate/, "Reading Lens regeneration must remain owner-only");
assert.match(lensCardSource, /isPreparing = false/);
assert.match(lensCardSource, /Reading Lens couldn't be prepared for this session\./);
assert.match(lensCardSource, /canEdit && !isPreparing/);
assert.match(detailSource, /isPreparing=\{\s*enrichmentPending\s*&&\s*pendingEnrichmentLogId\s*===\s*log\.id\s*\}/);
assert.match(lensCardSource, /RotateCcw/, "Populated Reading Lens cards must expose the established retry icon");
assert.ok(lensCardSource.includes('{canEdit && <button') && lensCardSource.includes('aria-label="Retry Reading Lens"'), "Only owners can retry a populated Reading Lens");
assert.match(lensCardSource, /disabled=\{retrying\}/, "Reading Lens retry must prevent duplicate requests");
assert.match(lensCardSource, /event\.stopPropagation\(\)/, "Retry must not toggle the Reading Lens details");
assert.match(lensCardSource, /await onRetry\(\)/, "Retry must reuse the existing Reading Lens mutation callback");


const retryStart = detailSource.indexOf("const retryReadingLens");
const retryEnd = detailSource.indexOf("const retryStoryThread", retryStart);
const retrySource = detailSource.slice(retryStart, retryEnd);
assert.doesNotMatch(retrySource, /await load\(\)/, "Reading Lens retry must not trigger page-level loading");
assert.match(retrySource, /const lens = await api\.retryReadingLens\(id, logId\)/);
assert.match(retrySource, /setLenses\(\(previous\)\s*=>\s*\[\s*lens,\s*\.\.\.previous\.filter/, "Reading Lens retry must optimistically upsert the fresh analysis");
console.log("READING_LENS_FIXTURES_OK");
