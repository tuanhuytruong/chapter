import path from "node:path";
import { routeBudgets } from "./route-budget.config";
import { closure, readManifest, resolveManifestKey, sumEntries } from "./route-assets";

const distDir = path.resolve("dist");
const manifest = readManifest(distDir);
const entryClosure = closure(manifest, "index.html");

for (const route of routeBudgets) {
  const routeClosure = route.manifestKey === "index.html"
    ? entryClosure
    : [...new Set([...entryClosure, ...closure(manifest, resolveManifestKey(manifest, route.manifestKey))])];
  const bytes = sumEntries(distDir, manifest, routeClosure);
  console.log(`[perf] route=${route.id} label=${JSON.stringify(route.label)} raw=${bytes.raw} gzip=${bytes.gzip} brotli=${bytes.brotli} gzip_budget=${route.initialGzipBudget}`);
}
