import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shell = await readFile(new URL("../src/components/AppShell.tsx", import.meta.url), "utf8");
const detail = await readFile(new URL("../src/pages/BookDetail.tsx", import.meta.url), "utf8");
assert.match(shell, /hidden shrink-0 items-center gap-6[^\n]*md:flex/, "desktop navigation starts at md");
assert.match(shell, /md:hidden/, "compact header controls remain through the 640–767px range");
assert.doesNotMatch(shell, /gap-6[^\n]*sm:flex/, "desktop navigation must not start at sm");
assert.match(shell, /no-underline/, "header links explicitly suppress browser link decoration");
assert.match(detail, /md:grid-cols-\[104px_minmax\(0,1fr\)\]/, "Book Detail tablet grid starts at md");
assert.doesNotMatch(detail, /sm:grid-cols-\[104px_minmax\(0,1fr\)\]/, "Book Detail is single column at a 677px viewport");
console.log("firefox responsive layout contract passed");
