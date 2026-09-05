---
type: operations
title: Verification Scripts & Operations
description: Runbook notes on running verification scripts, testing suites, and database migrations in OpenWiki.
tags: [operations, verification, testing, migrations, runbook]
sources:
  - id: openwiki-source-6251e90fd58f3c041d6f5c9b
    resource: repo://scripts/verify-podcast.ts
  - id: openwiki-source-2af1b88b1e8e0259806fc72d
    resource: repo://scripts/verify-reading-intention-reflection.ts
  - id: openwiki-source-f19bd693059c4c56bc4e791e
    resource: repo://scripts/verify-reading-progress-companion.ts
  - id: openwiki-source-13927404d8ceb664565801bb
    resource: repo://scripts/verify-upload-content.ts
  - id: openwiki-source-125e76395473d098c7269d6d
    resource: repo://src/db/schema.sql
generated: {by: "openwiki/0.4.0", at: "2026-08-26T19:17:20.603Z"}
verified:
  - by: openwiki/0.5.0
    at: 2026-09-05T16:00:46.565Z
---

# Verification Scripts & Operations

OpenWiki and its underlying application codebase include a robust suite of verification scripts and database migration workflows to ensure data integrity, regression safety, and correct feature behavior across releases.

## Overview of Verification Scripts

Verification scripts live under the `/scripts/` directory. They are standalone TypeScript modules executed against either ephemeral in-memory databases (`pg-mem`) or integration test environments to validate end-to-end functionality, schema compliance, and third-party integrations (such as AI parsing, audio generation, and authentication rate-limiting).

Common verification scripts include:
- **`verify-podcast.ts`**: Tests podcast catalog grouping, EPUB chapter extraction, Telegram archiving simulation, audio range requests, and playlist resume progress persistence repo://scripts/verify-podcast.ts.
- **`verify-reading-intention-reflection.ts`**: Validates reading intention constraints, column migrations, and AI reflection output contracts repo://scripts/verify-reading-intention-reflection.ts.
- **`verify-reading-progress-companion.ts`**: Checks AI reading progress companion prompts, JSON parsing rules, and boundary conditions for reading sessions repo://scripts/verify-reading-progress-companion.ts.
- **`verify-upload-content.ts`**: Tests file upload validation for PDFs and EPUB containers, handling of scanned non-selectable PDFs, Mojibake repair for unicode filenames, and secure stored filename sanitization repo://scripts/verify-upload-content.ts.

## Running Verification Scripts

Verification scripts are executed using Node.js with TypeScript support (via `tsx` or standard build steps):

```bash
npx tsx scripts/verify-podcast.ts
npx tsx scripts/verify-reading-intention-reflection.ts
npx tsx scripts/verify-reading-progress-companion.ts
npx tsx scripts/verify-upload-content.ts
```

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Parse error on line 10: ...r & Exit Non-Zero"]<<caption: Verificat Expecting 'SEMI', 'NEWLINE', 'SPACE', 'EOF', 'subgraph', 'end', 'acc_title', 'acc_descr', 'acc_descr_multiline_value', 'AMP', 'COLON', 'STYLE', 'LINKSTYLE', 'CLASSDEF', 'CLASS', 'CLICK', 'DOWN', 'DEFAULT', 'NUM', 'COMMA', 'NODE_STRING', 'BRKT', 'MINUS', 'MULT', 'UNICODE_TEXT', 'direction_tb', 'direction_bt', 'direction_rl', 'direct -->
```text
flowchart TD
    A["Developer / CI Pipeline"] --> B["Select Verification Script (scripts/*.ts)"]
    B --> C{Database Environment}
    C -->|Ephemeral Test| D["pg-mem In-Memory PostgreSQL"]
    C -->|Integration Test| E["Live Test Database"]
    D --> F["Execute Assertions (Node assert / custom checks)"]
    E --> F
    F -->|Success| G["Console PASS / Contract OK"]
    F -->|Failure| H["Throw Assertion Error & Exit Non-Zero"]
<<caption: Verification script execution flow from invocation to assertion and reporting.>>
```

## Database Migrations & Schema Management

Database schemas and migrations are managed through SQL scripts located under `src/db/schema.sql` and the `migrations/` directory.

### Core Schema (`src/db/schema.sql`)
The core schema defines the complete relational model for the application inside the PostgreSQL `chapter` schema repo://src/db/schema.sql#L15:
- **Users & Auth**: `chapter.users`, `chapter.user_login_events`, `chapter.password_reset_tokens`, and `chapter.auth_rate_limits`.
- **Books & Content**: Books, chapters, reading units, reading logs, and intentions.
- **Podcasts & Playback**: Podcast metadata, narrators, playback progress, and listen events.

Applying the base schema:
```bash
psql "$DATABASE_URL" -f src/db/schema.sql
```

### Migration Execution
Incremental migrations handle feature additions without disrupting existing data. For instance, adding reading intentions involves both schema updates and migration files repo://scripts/verify-reading-intention-reflection.ts#L7-L13:
```sql
ALTER TABLE chapter.books ADD COLUMN IF NOT EXISTS reading_intention TEXT;
```

## Operational Best Practices

1. **Always run verification scripts before committing**: Ensure all contracts (`UPLOAD_CONTENT_CONTRACT_OK`, `READING_PROGRESS_COMPANION_FIXTURES_OK`, etc.) pass cleanly.
2. **Handle schema search paths correctly**: Ensure database connections set the search path to include the `chapter` schema as configured in the application runtime.
3. **Isolate test fixtures**: Use ephemeral `pg-mem` instances for unit-level verification scripts to avoid polluting production or development databases.
