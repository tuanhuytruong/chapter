import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseReadingLensAnalysis } from "../src/readingLens.js";

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

const lensCardSource = readFileSync(new URL("../src/components/ReadingLensCard.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
const booksRouteSource = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
const sharedLensStart = booksRouteSource.indexOf('booksRouter.get("/:id/reading-lens"');
const sharedLensEnd = booksRouteSource.indexOf('booksRouter.get("/:id/logs/:logId/reading-lens"', sharedLensStart);
const sharedLensRoute = booksRouteSource.slice(sharedLensStart, sharedLensEnd);
assert.doesNotMatch(sharedLensRoute, /owner_id/, "Persisted Reading Lens data must be readable by all authenticated readers");
assert.match(detailSource, /else setLenses\(await api\.getReadingLens\(id\)\)/, "Non-owners must load persisted Reading Lens data into Book Detail");
assert.doesNotMatch(detailSource.slice(detailSource.indexOf("const load"), detailSource.indexOf("useEffect(() => { load();")), /if \(b\.can_edit\)/, "Loading shared Reading Lens data must not be owner-gated in Book Detail");
assert.match(booksRouteSource, /reading-lens\/retry", async \(req: Request, res: Response\) => \{\n  const \{ id, logId \} = req\.params;\n  if \(!await ownerCanMutate/, "Reading Lens regeneration must remain owner-only");
assert.match(lensCardSource, /isPreparing = false/);
assert.match(lensCardSource, /Reading Lens couldn't be prepared for this session\./);
assert.match(lensCardSource, /canEdit && !isPreparing/);
assert.match(detailSource, /isPreparing=\{enrichmentPending && pendingEnrichmentLogId === log\.id\}/);
const retryStart = detailSource.indexOf("const retryReadingLens");
const retryEnd = detailSource.indexOf("const retryStoryThread", retryStart);
const retrySource = detailSource.slice(retryStart, retryEnd);
assert.doesNotMatch(retrySource, /await load\(\)/, "Reading Lens retry must not trigger page-level loading");
assert.match(retrySource, /const lens = await api\.retryReadingLens\(id, logId\)/);
assert.match(retrySource, /setLenses\(previous => \[lens, \.\.\.previous\.filter/);
console.log("READING_LENS_FIXTURES_OK");
