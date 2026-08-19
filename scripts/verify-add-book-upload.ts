import assert from "node:assert/strict";
import { validateUploadResult } from "../src/api.js";
import { readFile } from "node:fs/promises";

const modal = await readFile(new URL("../src/components/AddBookModal.tsx", import.meta.url), "utf8");
assert.match(modal, /const \[uploadError, setUploadError\] = useState<string \| null>\(null\)/, "modal keeps upload error locally");
assert.match(modal, /setUploadError\(null\);[\s\S]{0,200}const oldPath/, "new selection clears prior upload error");
assert.match(modal, /setUploadError\(err\.message \|\| 'Could not upload this file/, "upload rejection is shown locally");
assert.match(modal, /\{uploadError && <p role="alert"/, "modal renders an accessible inline upload alert");
const api = await readFile(new URL("../src/api.ts", import.meta.url), "utf8");
assert.match(api, /reject\(new Error\(body\?\.error \|\| "Could not upload this file/, "upload errors use the server's reader-facing message without an HTTP status prefix");
assert.doesNotMatch(api, /xhr\.status}: \$\{body\?\.error/, "upload errors never expose the HTTP status prefix");
const daySummary = await readFile(new URL("../src/components/DaySummary.tsx", import.meta.url), "utf8");
assert.match(daySummary, /text-sm text-natural-dark font-sans leading-relaxed/, "casual session prose uses text-sm");
assert.match(daySummary, /text-sm leading-relaxed text-natural-dark/, "Deep Reading fallback prose uses text-sm");
assert.match(daySummary, /whitespace-pre-wrap text-sm leading-relaxed text-natural-dark/, "Deep Reading section prose uses text-sm");
assert.match(daySummary, /flex gap-1\.5 text-sm text-natural-muted font-sans/, "Key insights use 14px text-sm");

const epub = validateUploadResult({
  file_path: "/private/upload.epub",
  file_type: "epub",
  filename: "Who moved my cheese?.epub",
  size: 1,
  books_dir: "/private",
});
assert.equal(epub.file_type, "epub");
assert.equal(epub.file_path, "/private/upload.epub");

for (const invalid of [
  {},
  { file_path: "", file_type: "epub", filename: "book.epub" },
  { file_path: "/private/book", file_type: "txt", filename: "book.txt" },
  { file_path: "/private/book", file_type: "pdf", filename: "" },
]) {
  assert.throws(() => validateUploadResult(invalid), /usable file/);
}

console.log("add-book upload contract fixtures passed");