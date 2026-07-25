import assert from "node:assert/strict";
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
const invalidQuote = parseReadingLensAnalysis(valid.replace("Silicon changes power.\",\"confidence", "Invented quote.\",\"confidence"), source);
assert.equal(invalidQuote.quote, null);
assert.ok(invalidQuote.confidenceNotes.length > 0);
assert.throws(() => parseReadingLensAnalysis("not json", source));
console.log("READING_LENS_FIXTURES_OK");
