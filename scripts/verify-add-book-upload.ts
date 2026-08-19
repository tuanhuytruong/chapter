import assert from "node:assert/strict";
import { validateUploadResult } from "../src/api.js";
import { readFile } from "node:fs/promises";

const modal = await readFile(new URL("../src/components/AddBookModal.tsx", import.meta.url), "utf8");
assert.match(modal, /const \[uploadError, setUploadError\] = useState<string \| null>\(null\)/, "modal keeps upload error locally");
assert.match(modal, /setUploadError\(null\);[\s\S]{0,200}const oldPath/, "new selection clears prior upload error");
assert.match(modal, /setUploadError\(err\.message \|\| 'Could not upload this file/, "upload rejection is shown locally");
assert.match(modal, /\{uploadError && <p role="alert"/, "modal renders an accessible inline upload alert");

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