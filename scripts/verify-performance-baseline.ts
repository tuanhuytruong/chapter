import fs from "node:fs";

function source(path: string): string { return fs.readFileSync(path, "utf8"); }
function expect(value: boolean, message: string): void { if (!value) throw new Error(message); }

const packageJson = JSON.parse(source("package.json"));
const analytics = source("src/analytics.ts");
const app = source("src/App.tsx");
const assetAudit = source("scripts/perf/audit-assets.ts");
const routeAssets = source("scripts/perf/route-assets.ts");
const routeBudgets = source("scripts/perf/route-budget.config.ts");
const dbAudit = source("scripts/perf/audit-db.sql");
const docs = source("docs/performance-baseline.md");

expect(packageJson.scripts["perf:audit:assets"] === "tsx scripts/perf/audit-assets.ts", "asset audit script missing");
expect(packageJson.scripts["perf:report:routes"] === "tsx scripts/perf/route-assets-report.ts", "route report script missing");
expect(routeAssets.includes("readManifest") && routeAssets.includes("resolveManifestKey") && routeAssets.includes("brotliCompressSync"), "route asset manifest accounting missing");
expect(routeBudgets.includes("initialGzipBudget") && routeBudgets.includes("largestLazyChunkGzipBudget"), "route budget configuration missing");
expect(analytics.includes('"route_perf_sample"'), "privacy-safe route performance event missing");
expect(analytics.includes("routeAnalyticsId") && analytics.includes('"/books/:id"'), "dynamic book routes must be anonymised");
expect(analytics.includes('pathname.replace(/\\/+$/, "")'), "trailing slash book routes must be normalised before analytics");
expect(analytics.includes("capture_pageview: false") && analytics.includes("capture_pageleave: false"), "managed page URL capture must remain disabled");
expect(analytics.includes("render_duration_bucket") && analytics.includes("device_class"), "route event must use bucketed metadata");
expect(!analytics.includes("bookTitle") && !analytics.includes("rawText"), "analytics must not add reading content fields");
expect(app.includes("RoutePerformanceObserver") && app.includes("captureRoutePerformance"), "route observer missing");
expect(assetAudit.includes("total_js_raw") && assetAudit.includes("largest_lazy_chunk") && assetAudit.includes("totalJavaScriptRawBudget"), "route-aware asset budget audit incomplete");
expect(dbAudit.includes("BEGIN READ ONLY") && dbAudit.includes("ROLLBACK"), "DB audit must be read-only and rollback-only");
expect(dbAudit.includes("EXPLAIN (ANALYZE, BUFFERS)"), "DB audit must capture query plans");
expect(docs.includes("Performance Baseline") && docs.includes("Decision rules"), "baseline documentation incomplete");

console.log("performance baseline verification passed");
