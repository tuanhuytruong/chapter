import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { validateBookUpload } from "../src/routes/upload.ts";

const dir = await mkdtemp(path.join(tmpdir(), "chapter-upload-verify-"));
const file = (name: string, size: number) => ({ path: path.join(dir, name), originalname: name, size } as Express.Multer.File);

try {
  const pdf = file("valid.pdf", 12);
  await writeFile(pdf.path, Buffer.from("%PDF-1.7\n%%EOF"));
  assert.equal(await validateBookUpload(pdf), "pdf", "valid PDF signature is accepted");

  const fakePdf = file("fake.pdf", 9);
  await writeFile(fakePdf.path, Buffer.from("not a pdf"));
  await assert.rejects(() => validateBookUpload(fakePdf), /not a valid PDF/, "renamed non-PDF is rejected");

  const epubZip = new JSZip();
  epubZip.file("mimetype", "application/epub+zip");
  epubZip.file("META-INF/container.xml", "<container/>");
  epubZip.file("OEBPS/chapter.xhtml", "<html><body>Chapter</body></html>");
  const epubBuffer = await epubZip.generateAsync({ type: "nodebuffer" });
  const epub = file("valid.epub", epubBuffer.length);
  await writeFile(epub.path, epubBuffer);
  assert.equal(await validateBookUpload(epub), "epub", "valid EPUB container is accepted");

  const fakeEpubZip = new JSZip();
  fakeEpubZip.file("readme.txt", "not an epub");
  const fakeEpubBuffer = await fakeEpubZip.generateAsync({ type: "nodebuffer" });
  const fakeEpub = file("fake.epub", fakeEpubBuffer.length);
  await writeFile(fakeEpub.path, fakeEpubBuffer);
  await assert.rejects(() => validateBookUpload(fakeEpub), /not a valid EPUB/, "generic ZIP renamed to EPUB is rejected");

  console.log("UPLOAD_CONTENT_CONTRACT_OK");
} finally {
  await rm(dir, { recursive: true, force: true });
}
