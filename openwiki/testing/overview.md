---
type: concept
title: Testing Overview
description: Testing guidance, test file organization, and how verification scripts serve as robust integration checks in Chapter.
tags: [testing, verification, scripts, integration-tests, quality-assurance]
verified:
  - by: openwiki/0.4.0
    at: 2026-08-26T19:17:20.603Z
sources:
  - id: openwiki-source-6251e90fd58f3c041d6f5c9b
    resource: repo://scripts/verify-podcast.ts
  - id: openwiki-source-2af1b88b1e8e0259806fc72d
    resource: repo://scripts/verify-reading-intention-reflection.ts
generated: {by: "openwiki/0.4.0", at: "2026-08-26T19:17:20.603Z"}
---

# Testing Overview

Testing and verification in **Chapter** rely on a pragmatic, script-driven integration approach rather than traditional heavy testing frameworks (such as Jest or Mocha). Because the repository functions as a self-hosted reading companion with rich domain logic—such as EPUB chapter splitting, AI reader analysis, reading intent tracking, podcast audio streaming, and database migrations—verification is centered around standalone TypeScript scripts executing against ephemeral in-memory PostgreSQL databases (`pg-mem`) or integration test harnesses.

## Testing Philosophy & Strategy

1. **Script-Driven Integration Checks**: Each major feature or subsystem is accompanied by a dedicated verification script in `scripts/` (e.g., `verify-podcast.ts`, `verify-reading-intention-reflection.ts`). These scripts simulate realistic end-to-end user workflows, API calls, and database states.
2. **Ephemeral In-Memory Isolation**: Many verification scripts leverage `pg-mem` to instantiate a clean PostgreSQL database in memory, register necessary custom functions (like `gen_random_uuid`), apply schema definitions, seed test fixtures, and execute assertions without polluting external databases.
3. **Strict Assertion Contracts**: Verification scripts utilize standard assertion modules (`node:assert/strict` or custom assertion helpers) to validate HTTP status codes, JSON response payloads, database records, and byte-level streaming correctness (such as HTTP Range requests for audio playback).
4. **Fast Feedback Loop**: Developers and CI pipelines run specific verification scripts instantly via `npx tsx scripts/<script-name>.ts`, ensuring rapid regression detection across updates.

## Key Test Files & Verification Suites

Verification scripts are located in the `/scripts/` directory. Notable examples include:

- **`scripts/verify-podcast.ts`**: Verifies podcast catalog grouping, EPUB chapter extraction, archive-pending states, audio streaming with HTTP Range requests, and resume progress tracking repo://scripts/verify-podcast.ts.
- **`scripts/verify-reading-intention-reflection.ts`**: Validates database migrations for reading intentions, character length constraints, API routing contracts, and AI-generated reading reflection prompts repo://scripts/verify-reading-intention-reflection.ts.
- **`scripts/verify-upload-content.ts`**: Tests file upload validation, EPUB/PDF parsing, mojibake repair for unicode filenames, and secure filename sanitization repo://openwiki/operations/verification-scripts.md.
- **`scripts/verify-reading-progress-companion.ts`**: Checks AI reading progress companion prompts, JSON parsing rules, and session boundary conditions repo://openwiki/operations/verification-scripts.md.

## Running Verification Scripts

To execute individual verification suites during development or in a CI environment:

```bash
npx tsx scripts/verify-podcast.ts
npx tsx scripts/verify-reading-intention-reflection.ts
npx tsx scripts/verify-upload-content.ts
```

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Parse error on line 9: ...Exit Non-Zero"] <<caption: End-to-en Expecting 'SEMI', 'NEWLINE', 'SPACE', 'EOF', 'subgraph', 'end', 'acc_title', 'acc_descr', 'acc_descr_multiline_value', 'AMP', 'COLON', 'STYLE', 'LINKSTYLE', 'CLASSDEF', 'CLASS', 'CLICK', 'DOWN', 'DEFAULT', 'NUM', 'COMMA', 'NODE_STRING', 'BRKT', 'MINUS', 'MULT', 'UNICODE_TEXT', 'direction_tb', 'direction_bt', 'direction_rl', 'direction_ -->
```text
flowchart TD
    A["Developer / CI Invocation"] --> B["Select Verification Script (scripts/*.ts)"]
    B --> C["Spin up Ephemeral pg-mem / Express App"]
    C --> D["Seed Test Fixtures & Database Schema"]
    D --> E["Execute HTTP Requests & Domain Logic"]
    E --> F{Assert Results}
    F -->|Success| G["Print Success Log & Exit 0"]
    F -->|Failure| H["Throw Assertion Error & Exit Non-Zero"]
    <<caption: End-to-end flow of a Chapter verification script.>>
```

## Writing and Extending Tests

When introducing new features, domain capabilities, or schema changes in Chapter:
1. **Create a Verification Script**: Add a new script under `scripts/verify-<feature>.ts`.
2. **Setup In-Memory DB or Test Environment**: Use `pg-mem` and `express` to spin up an isolated app instance reproducing the required route handlers.
3. **Assert Contracts**: Assert both happy paths and boundary error cases (e.g., unauthorized access, invalid negative parameters, payload size limits).
4. **Document Integration**: Reference the script in `/openwiki/operations/verification-scripts.md` and ensure it runs successfully in the development workflow.
