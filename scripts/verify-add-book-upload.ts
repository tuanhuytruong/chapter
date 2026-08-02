import assert from "node:assert/strict";
import { validateUploadResult } from "../src/api.js";

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