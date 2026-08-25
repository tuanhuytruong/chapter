---
type: guide
title: Testing and Verification Procedures
description: Comprehensive documentation on running verification scripts, test suites, and local builds for the OpenWiki platform.
tags: [testing, verification, scripts, build, quality-assurance]
verified:
  - by: openwiki/0.4.0
    at: 2026-08-25T17:44:34.504Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
generated: {by: "openwiki/0.4.0", at: "2026-08-25T17:44:34.504Z"}
---

# Testing & Verification

The OpenWiki platform includes a robust set of verification scripts, TypeScript type-checking tools, and build pipelines to ensure system integrity, database schema consistency, and feature correctness.

## Overview of Verification Scripts

Verification scripts are located in the `scripts/` directory and are typically executed via npm run scripts defined in `package.json`. These scripts validate specific subsystems, ranging from reading progress companions and AI readers to database integrity and platform headers.

### Running Verification Scripts

To run any verification script, use the corresponding npm command:

```bash
npm run verify:reading-progress-companion
npm run verify:ai-reader
npm run verify:auth-rate-limit
```

### Representative Verification Scripts

- **`scripts/verify-reading-progress-companion.ts`**: Validates reading progress companion prompt generation, parsing logic, and schema conformance for reading sessions [repo://scripts/verify-reading-progress-companion.ts#L1-L20].
- **Database & Platform Verification**: Scripts such as `scripts/verify-platform-db.ts` and `scripts/verify-platform-headers.ts` ensure database connectivity, migration validity, and correct HTTP/platform header handling.
- **Feature-Specific Verification**: Dozens of focused scripts (e.g., `verify-quotes-archive.ts`, `verify-podcast.ts`, `verify-library-shelf-switcher.ts`) test isolated features against expected behaviors and mock data.

## Type Checking & Linting

Before running builds or deploying changes, TypeScript type-checking ensures no type regressions have been introduced:

```bash
npm run lint
```

This runs `tsc --noEmit` against the project configuration (`tsconfig.json`).

## Building the Project

The application bundles both client-side assets (using Vite) and server-side code (using esbuild for Node.js):

```bash
npm run build
```

The build process:
1. Runs Vite to bundle the frontend application.
2. Uses esbuild to bundle `server.ts` into an ESM module (`dist/server.mjs`).
3. Copies necessary worker scripts (such as `src/pdfExtractorWorker.mjs`) to the distribution directory [repo://package.json#L8].

## Local Development & Startup

To start the local development server with hot-reloading via `tsx`:

```bash
npm run dev
```

To run the production-built server locally:

```bash
npm start
```
