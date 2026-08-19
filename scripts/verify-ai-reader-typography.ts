import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/BookWiki.tsx", import.meta.url), "utf8");
assert.match(source, /text-sm font-bold text-natural-sage[^>]*>[^<]*<Brain[^>]*\/>AI Reader/, "AI Reader heading uses 14px");
assert.match(source, /text-sm leading-relaxed text-natural-dark[^>]*>\{wiki\.book_so_far/, "overview uses 14px");
assert.match(source, /text-sm font-bold text-natural-sage[^>]*>Reading Map/, "Reading Map label uses 14px");
assert.match(source, /text-sm leading-relaxed text-natural-stone[^>]*>\{connection\.explanation/, "connections prose uses 14px");
assert.match(source, /<b className="text-sm text-natural-dark">\{sessionName/, "session names use 14px");
assert.match(source, /text-xs font-bold uppercase tracking-wider text-natural-sage[^>]*>At this point/, "compact headings use 12px");
assert.match(source, /text-xs font-bold text-natural-sage[^>]*>\{pageLabel/, "page evidence uses 12px");
console.log("ai-reader typography contract passed");
