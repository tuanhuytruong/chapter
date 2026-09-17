import { stat } from "node:fs/promises";
import { renderPdfPageToTempImage } from "../src/pdfIllustrationRenderer.ts";

const fixture = "node_modules/pdf-parse/test/data/01-valid.pdf";
const image = await renderPdfPageToTempImage(fixture, 1);
const rendered = await stat(image.path);
if (image.mimeType !== "image/png" || rendered.size < 1) {
  throw new Error("renderer did not produce a bounded PNG");
}
await image.cleanup();
await stat(image.path).then(
  () => { throw new Error("temporary illustration image was not cleaned up"); },
  () => undefined,
);
console.log(JSON.stringify({ renderer: "ok", bytes: rendered.size }));
