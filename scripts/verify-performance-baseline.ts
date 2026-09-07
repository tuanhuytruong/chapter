import fs from "node:fs";

function source(path: string): string { return fs.readFileSync(path, "utf8"); }
function expect(value: boolean, message: string): void { if (!value) throw new Error(message); }

const packageJson = JSON.parse(source("package.json"));
const analytics = source("src/analytics.ts");
const app = source("src/App.tsx");
const assetAudit = source("scripts/perf/audit-assets.ts");
const dbAudit = source("scripts/perf/audit-db.sql");
const docs = source("docs/performance-baseline.md");

expect(packageJson.scripts["perf:audit:assets"] === "tsx scripts/perf/audit-assets.ts", "asset audit script missing");
expect(analytics.includes('"route_perf_sample"'), "privacy-safe route performance event missing");
expect(analytics.includes("routeAnalyticsId") && analytics.includes('"/books/:id"'), "dynamic book routes must be anonymised");
expect(analytics.includes("render_duration_bucket") && analytics.includes("device_class"), "route event must use bucketed metadata");
expect(!analytics.includes("bookTitle") && !analytics.includes("rawText"), "analytics must not add reading content fields");
expect(app.includes("RoutePerformanceObserver") && app.includes("captureRoutePerformance"), "route observer missing");
expect(assetAudit.includes("CHAPTER_PERF_TOTAL_JS_BUDGET_BYTES") && assetAudit.includes("built_js_bytes"), "asset budget audit incomplete");
expect(dbAudit.includes("BEGIN READ ONLY") && dbAudit.includes("ROLLBACK"), "DB audit must be read-only and rollback-only");
expect(dbAudit.includes("EXPLAIN (ANALYZE, BUFFERS)"), "DB audit must capture query plans");
expect(docs.includes("Performance Baseline") && docs.includes("Decision rules"), "baseline documentation incomplete");

console.log("performance baseline verification passed");
