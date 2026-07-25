import assert from "node:assert/strict";
import { parseSummary } from "../src/llm.js";

const deep = `## Core argument
A conclusion follows from the supplied premise.

## Argument map
1. **Claim:** A grounded claim.
   - **Support:** A stated reason.
   - **Example:** A concrete instance from the reading.
   - **Implication:** A consequence.

## Assumptions & limits
- Not established in this reading.

## Key concepts
- **Premise:** A starting proposition.

## Questions to carry forward
- What evidence comes next?

## Insights
- First durable insight.
- Second durable insight.
- Third durable insight.
- This fourth item must not become a review card.

## Quote
"A conclusion follows."`;

const parsedDeep = parseSummary(deep, "deep_reading");
assert.equal(parsedDeep.key_insights.length, 3);
assert.equal(parsedDeep.quote, "A conclusion follows.");
assert.match(parsedDeep.summary, /## Argument map/);
assert.match(parsedDeep.summary, /\*\*Example:\*\* A concrete instance/);
assert.doesNotMatch(parsedDeep.summary, /## Insights/);

const casual = parseSummary("## Summary\nA clear summary.\n\n## Insights\n- One\n- Two\n\n## Quote\nN/A");
assert.equal(casual.summary, "A clear summary.");
assert.deepEqual(casual.key_insights, ["One", "Two"]);
assert.equal(casual.quote, null);

console.log("summary-mode fixtures passed");
