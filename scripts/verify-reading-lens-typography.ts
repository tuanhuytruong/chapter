import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/ReadingLensCard.tsx", import.meta.url), "utf8");
assert.match(source, /text-sm font-bold uppercase tracking-wider text-natural-sage/, "Reading Lens heading and detail headings use 14px");
assert.match(source, /mt-1 text-sm leading-relaxed text-natural-dark/, "analyst summary uses 14px");
assert.match(source, /mt-2 space-y-1 text-sm leading-relaxed text-natural-stone/, "durable insights use 14px");
assert.match(source, /pt-3 text-sm leading-relaxed text-natural-dark/, "expanded Reading Lens content uses 14px");
console.log("reading lens typography contract passed");
