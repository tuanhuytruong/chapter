# Chapter Performance Baseline

**Scope:** DEV only. This document is a measurement record, not a claim of improvement.

## Privacy boundary

Performance/analytics data may include only route IDs, duration buckets, device class, status class, retry-count buckets, and aggregate asset sizes. It must not include book titles/authors, book/user IDs, raw reading content, notes, transcripts, filenames, private URLs, credentials, or upstream error bodies.

## Reproducible commands

```bash
npm run build
npm run perf:report:routes
npm run perf:audit:assets
set -a; source .env.local; set +a
psql "$DATABASE_URL" -v owner_id='DEV_OWNER_UUID' -v book_id='DEV_BOOK_UUID' \
  -f scripts/perf/audit-db.sql
```

Run browser measurements against authenticated DEV at 390×844 and 1366×768 with cold and warm cache. Record at least three samples for Library, Today, Book Detail (List/Journey/AI Reader), Podcasts, Review, Insights, and Quotes.

## Initial recorded evidence

- Git baseline: `bc13176` (DEV before this performance work).
- TypeScript baseline: `npm run lint` passed on DEV before edits.
- Shared NineRouter safety baseline: 5 paced request starts/sec; 30 in-flight requests; interactive work dispatches before background and one slot is reserved.
- Database logging already emits slow request/background query duration at or above 1 second. This audit adds explainable endpoint-query probes before adding indexes.
- First successful DEV build measured 1,002,269 uncompressed JavaScript bytes (294.42 kB gzip) in a single entry chunk. The temporary regression guardrail is 1,050,000 bytes; Phase 1 must split secondary routes and tighten the initial-entry budget.
- DEV query-plan audit (28 books / selected book 9 sessions): Library used a 0.133 ms sequential scan plus 25 kB sort; reading-log used `idx_reading_log_round` in 0.085 ms; AI Reader job lookup used its primary key in 0.012 ms; podcast lookup used its unique chapter/round index in 0.022 ms. No Phase 5 index is justified from this small DEV dataset.

## Results table

Fill with actual measurements only.

| Scenario | Device/cache | Samples | p50 | p75 | p95 | Notes |
|---|---|---:|---:|---:|---:|---|
| Library | | | | | | |
| Today | | | | | | |
| Book Detail – List | | | | | | |
| Book Detail – AI Reader | | | | | | |
| Podcasts | | | | | | |
| Review | | | | | | |
| Insights | | | | | | |
| Quotes | | | | | | |

## Decision rules

1. Do not virtualise a list until a measured render/interaction bottleneck proves normal progressive disclosure is insufficient.
2. Do not add database indexes until the matching `EXPLAIN (ANALYZE, BUFFERS)` identifies a real scan/sort bottleneck.
3. Do not add a queue service, Redis, or realtime transport without evidence that current durable feature-state plus visibility-aware polling cannot sustain demand.
4. Every future optimisation must record before/after results in this file.


## Route asset audit baseline — 2026-09-09

The previous `1,050,000 B` audit summed every JavaScript chunk and therefore did not distinguish first-load cost from optional routes. The route-aware audit uses Vite's production manifest, resolves static imports recursively, and measures raw, gzip, and Brotli bytes using Node's built-in compression. It is a build-artifact measurement; it does not inspect reading content or identifiers.

## Bundle split results — 2026-09-09

Post-optimization artifact at `120ed36` worktree plus this DEV performance change: total emitted JavaScript is **930,393 B raw**, below the transitional **950,000 B** total guard. Route cumulative payloads: auth bootstrap **83,256 B gzip**, Library **102,134 B gzip**, Today **92,623 B gzip**, Book Detail base **116,272 B gzip**. The largest optional lazy chunk is the PostHog module at **88,324 B gzip**, below the **100,000 B** ceiling.

The baseline 1,040,137 B total therefore decreased by **109,744 B raw** (about 10.6%). Motion was removed; all top-level pages and Book Detail companion panels are route/tab lazy. PostHog was tested as an async client adapter and retained only with existing privacy flags and metadata-only calls. Manual vendor chunks were deliberately not added because route-level splitting already produced clear cache boundaries and no evidence showed that manual grouping would reduce route payload.
