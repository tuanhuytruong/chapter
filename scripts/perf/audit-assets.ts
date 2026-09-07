import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
// Baseline captured from the pre-splitting DEV build. Tighten this after Phase 1
// moves secondary routes out of the entry chunk.
const limitBytes = Number(process.env.CHAPTER_PERF_TOTAL_JS_BUDGET_BYTES || 1_050_000);

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

const assets = listFiles(distDir)
  .filter((file) => /\.(?:js|css)$/i.test(file))
  .map((file) => ({ file: path.relative(process.cwd(), file), bytes: fs.statSync(file).size }))
  .sort((a, b) => b.bytes - a.bytes);

if (!assets.length) {
  throw new Error("No built JS/CSS assets found. Run npm run build before npm run perf:audit:assets.");
}

const jsBytes = assets.filter((asset) => asset.file.endsWith(".js")).reduce((total, asset) => total + asset.bytes, 0);
console.log(`[perf] built_js_bytes=${jsBytes} budget_bytes=${limitBytes}`);
for (const asset of assets) console.log(`[perf] asset=${asset.file} bytes=${asset.bytes}`);

if (jsBytes > limitBytes) {
  throw new Error(`Built JavaScript ${jsBytes} bytes exceeds the current baseline guardrail ${limitBytes} bytes.`);
}
