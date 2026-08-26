import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { validateBookUpload } from "../src/routes/upload.ts";
import { displayUploadFilename, storedUploadFilename, uploadExtension } from "../src/upload.ts";

const dir = await mkdtemp(path.join(tmpdir(), "chapter-upload-verify-"));
const file = (name: string, size: number) => ({ path: path.join(dir, name), originalname: name, size } as Express.Multer.File);

try {
  const pdf = file("valid.pdf", 0);
  await writeFile(pdf.path, await readFile(path.resolve("node_modules/pdf-parse/test/data/01-valid.pdf")));
  assert.equal(await validateBookUpload(pdf), "pdf", "PDF with selectable text is accepted");

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

  const scannedFixture = process.env.SCANNED_PDF_FIXTURE;
  if (scannedFixture) {
    const scanned = file("scanned.pdf", 0);
    await writeFile(scanned.path, await readFile(scannedFixture));
    await assert.rejects(
      () => validateBookUpload(scanned),
      /scanned image without selectable text/,
      "image-only PDF is rejected with a helpful warning",
    );
  }

  console.log("UPLOAD_CONTENT_CONTRACT_OK", JSON.stringify({ scannedFixtureChecked: Boolean(scannedFixture) }));
} finally {
  await rm(dir, { recursive: true, force: true });
}


const mojibake = "Chiáº¿n Binh Cáº§u Vá»“ng - Andrea Hirata & Dáº¡ Tháº£o.epub";
const vietnamese = "Chiến Binh Cầu Vồng - Andrea Hirata & Dạ Thảo.epub";
assert.equal(displayUploadFilename(mojibake), vietnamese, "lossless Latin-1 mojibake is repaired for display");
assert.equal(displayUploadFilename("Atomic Habits.PDF"), "Atomic Habits.PDF", "ASCII display filename remains unchanged");
assert.equal(uploadExtension(mojibake), ".epub", "repaired EPUB extension is recognized");
assert.equal(uploadExtension("Atomic Habits.PDF"), ".pdf", "case-insensitive PDF extension is recognized");
const stored = storedUploadFilename(mojibake, "testuuid");
assert.equal(stored, "chien-binh-cau-vong-andrea-hirata-da-thao-testuuid.epub", "stored filename is ASCII, no-diacritic, and deterministic with supplied suffix");
assert.match(stored, /^[a-z0-9.-]+$/, "stored filename contains only safe ASCII characters");
console.log("unicode upload filename fixtures passed");
