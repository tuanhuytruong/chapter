---
type: guide
title: Testing & Verification Scripts
description: Documentation covering verification scripts, test suites, type checking, and build procedures for OpenWiki.
tags: [testing, verification, scripts, build, quality-assurance, linting]
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-ad027b3e91609f1451769138
    resource: repo://scripts/verify-chapter-markers.ts
  - id: openwiki-source-6d428306e6d9164f86db303a
    resource: repo://scripts/verify-posthog-identity.ts
  - id: openwiki-source-1ebac31355226f017070baba
    resource: repo://scripts/verify-reading-forecast.ts
generated: { by: "openwiki/0.4.3", at: "2026-08-29T00:58:11.655Z" }
verified:
  - by: openwiki/0.5.0
    at: 2026-09-05T16:00:46.565Z
---

# Testing & Verification Scripts

The OpenWiki platform includes a dedicated suite of verification scripts located in the `scripts/` directory, alongside standard type checking, linting, and build pipelines. These scripts ensure schema integrity, privacy compliance, algorithmic correctness, and feature reliability.

## Overview of Verification Scripts

Verification scripts are stand-alone TypeScript files executed via Node (using loaders like `tsx`) or direct script entrypoints defined in `package.json`. These scripts validate specific subsystems, ranging from chapter markers and privacy filters to reading forecasts and database schemas.

### Seed Verification Scripts

The repository features several key verification scripts highlighting different aspects of platform validation:

- **`scripts/verify-chapter-markers.ts`**: Asserts chapter marker database table schemas, API routes (`/books/:id/markers`), UI component integrations (`ReadingMarkers`, `DaySummary`), and uniqueness/conflict handling constraints [repo://scripts/verify-chapter-markers.ts#L1-L16].
- **`scripts/verify-posthog-identity.ts`**: Enforces analytics privacy guarantees. It verifies that `posthog.identify()` receives only safe identifiers (`userId` and `account_handle`) and explicitly excludes sensitive user attributes such as email, display names, book titles, raw text, or notes [repo://scripts/verify-posthog-identity.ts#L1-L11].
- **`scripts/verify-reading-forecast.ts`**: Tests the reading forecast algorithm (`getReadingForecast` and `formatForecastDate`) across various session histories, sparse reading logs, date gaps, reading rounds, and book completion states [repo://scripts/verify-reading-forecast.ts#L1-L54].

### Running Verification Scripts

You can run individual verification scripts directly using `npx tsx` or via npm run scripts defined in `package.json`:

```bash
npx tsx scripts/verify-chapter-markers.ts
npx tsx scripts/verify-posthog-identity.ts
npx tsx scripts/verify-reading-forecast.ts
```

The project defines numerous verify:* scripts in `package.json` to test isolated features, database schemas, and platform behavior [repo://package.json#L6-L54].

## Type Checking & Linting

Before running builds or deploying changes, TypeScript type-checking ensures no type regressions have been introduced:

```bash
npm run lint
```

This runs `tsc --noEmit` against the TypeScript configuration (`tsconfig.json`) [repo://package.json#L11].

## Building the Project

The build pipeline bundles both client-side assets and server-side code:

```bash
npm run build
```

The build process:
1. Bundles the frontend with Vite.
2. Bundles server code with esbuild, outputting to `dist/server.mjs`.
3. Copies necessary worker scripts (such as `src/pdfExtractorWorker.mjs`) to the distribution directory [repo://package.json#L8].
