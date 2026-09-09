import path from "node:path";
import { allJavaScriptFiles, closure, readManifest, resolveManifestKey, sizeForFile, sumEntries } from "./route-assets";
import { largestLazyChunkGzipBudget, routeBudgets, totalJavaScriptRawBudget } from "./route-budget.config";

const distDir = path.resolve("dist");
const manifest = readManifest(distDir);
const entry = closure(manifest, "index.html");
const failures: string[] = [];

const total = allJavaScriptFiles(distDir).reduce((sum, file) => sum + sizeForFile(path.join(distDir, "assets", ".."), `assets/${file}`).raw, 0);
console.log(`[perf] total_js_raw=${total} budget=${totalJavaScriptRawBudget}`);
if (total > totalJavaScriptRawBudget) failures.push(`total JS raw ${total} exceeds ${totalJavaScriptRawBudget}`);

for (const route of routeBudgets) {
  const keys = route.manifestKey === "index.html" ? entry : [...new Set([...entry, ...closure(manifest, resolveManifestKey(manifest, route.manifestKey))])];
  const bytes = sumEntries(distDir, manifest, keys);
  const status = bytes.gzip <= route.initialGzipBudget ? "pass" : "fail";
  console.log(`[perf] route=${route.id} raw=${bytes.raw} gzip=${bytes.gzip} brotli=${bytes.brotli} gzip_budget=${route.initialGzipBudget} status=${status}`);
  if (status === "fail") failures.push(`${route.id} gzip ${bytes.gzip} exceeds ${route.initialGzipBudget}`);
}

const dynamicKeys = Object.keys(manifest).filter((key) => !manifest[key].isEntry && key !== "index.html");
const largest = dynamicKeys.map((key) => ({ key, bytes: sumEntries(distDir, manifest, [key]) })).sort((a, b) => b.bytes.gzip - a.bytes.gzip)[0];
if (largest) {
  console.log(`[perf] largest_lazy_chunk=${largest.key} raw=${largest.bytes.raw} gzip=${largest.bytes.gzip} budget=${largestLazyChunkGzipBudget}`);
  if (largest.bytes.gzip > largestLazyChunkGzipBudget) failures.push(`largest lazy chunk ${largest.key} gzip ${largest.bytes.gzip} exceeds ${largestLazyChunkGzipBudget}`);
}

if (failures.length) throw new Error(`Asset budget failures:\n- ${failures.join("\n- ")}`);
