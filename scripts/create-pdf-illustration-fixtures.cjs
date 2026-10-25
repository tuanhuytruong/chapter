const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const out = resolve("scripts/fixtures/pdf-illustrations");
mkdirSync(out, { recursive: true });

function pdf(objects) {
  const body = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body.join(""), "binary"));
    body.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xref = Buffer.byteLength(body.join(""), "binary");
  body.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) body.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  body.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.from(body.join(""), "binary");
}

function make(name, imageMatrix) {
  const text = "BT /F1 18 Tf 72 740 Td (Fixture text layer) Tj ET";
  const image = imageMatrix ? `q ${imageMatrix.join(" ")} cm /Im1 Do Q` : "";
  const stream = `${text}\n${image}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >>${imageMatrix ? " /XObject << /Im1 5 0 R >>" : ""} >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 26 >>\nstream\nFF000000FF000000FFFFFFFF>\nendstream",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
  ];
  writeFileSync(resolve(out, name), pdf(objects));
}

make("text-only.pdf", null);
// 300 x 300 points: 18.75% of the 600 x 800 point page.
make("large-raster.pdf", [300, 0, 0, 300, 100, 300]);
// 20 x 20 points: 0.083% of the page.
make("tiny-logo.pdf", [20, 0, 0, 20, 550, 760]);
console.log(JSON.stringify({ out, fixtures: ["text-only.pdf", "large-raster.pdf", "tiny-logo.pdf"] }));
