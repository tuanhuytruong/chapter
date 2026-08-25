---
type: architecture
title: Database & Storage
description: Comprehensive documentation of the database schema, migrations, connection handling, and storage repositories in Chapter.
tags: [database, postgresql, migrations, schema, storage, repositories]
verified:
  - by: openwiki/0.4.0
    at: 2026-08-25T17:44:34.504Z
sources:
  - id: openwiki-source-6b57b34d9d5d29d041e98f86
    resource: repo://migrations/20260825_add_reading_progress_companions.sql
  - id: openwiki-source-70d4664310eebb80ab5b564c
    resource: repo://src/db.ts
  - id: openwiki-source-125e76395473d098c7269d6d
    resource: repo://src/db/schema.sql
generated: {by: "openwiki/0.4.0", at: "2026-08-25T17:44:34.504Z"}
---

# Database & Storage

The database layer of Chapter is built on **PostgreSQL** (version 13+) and is designed around a multi-tenant, user-isolated relational model. Connection management, schema bootstrapping, migrations, query timeouts, and repositories are structured for high reliability and secure tenant separation.

## Database Connection & Lifecycle Management

Database connectivity is managed centrally via `src/db.ts`, leveraging the `pg` connection pool.

### Key Mechanisms (`src/db.ts`)
- **Type Parsers**: Configures PostgreSQL DATE columns (OID `1082`) to be returned as plain `'YYYY-MM-DD'` strings instead of JavaScript `Date` objects. This prevents time-zone shifts and client-side ISO serialization bugs (`Invalid Date`).
  - *Evidence:* repo://src/db.ts#L8-L11
- **Search Path**: Forces all connections into the `chapter` schema via connection options (`-c search_path=chapter`).
  - *Evidence:* repo://src/db.ts#L39
- **Timeouts & Safety**: Separates query budgets into **Request** and **Background** timeouts (`statement_timeout` and `lock_timeout`) applied locally per transaction/query:
  - *Request Budgets*: Enforces strict bounds for standard API calls to maintain responsiveness.
  - *Background Budgets*: Provides larger, bounded allowances for batch jobs, migrations, and AI processing tasks.
  - *Evidence:* repo://src/db.ts#L15-L23, repo://src/db.ts#L56-L62, repo://src/db.ts#L101-L109
- **Transactions**: Provides robust transaction helpers (`withTransaction`, `withBackgroundTransaction`) that wrap operations in `BEGIN`, `COMMIT`, with automatic `ROLLBACK` on failure and structured outcome logging.
  - *Evidence:* repo://src/db.ts#L120-L152
- **Schema Bootstrap & Verification**:
  - `ensureSchema()` reads `src/db/schema.sql`, strips comments, splits statements by `;`, and executes them against the pool. It gracefully handles harmless permission errors when `CREATE SCHEMA` is restricted from runtime DB roles.
  - `verifyCoreSchema()` queries `to_regclass` to ensure all core feature tables exist before accepting authenticated requests.
  - *Evidence:* repo://src/db.ts#L154-L200

---

## Schema Architecture (`src/db/schema.sql`)

The complete schema lives in `src/db/schema.sql` and is organized around users, books, reading logs, AI readers, social/community features, billing, and subscription management.

### Core Tables Summary
1. **Users & Auth**:
   - `chapter.users`: Stores user profiles, authentication hashes, OAuth sub bindings, environment flags (`prd` | `dev`), and session metadata.
   - `chapter.user_login_events`: Tracks login occurrences, auth methods, and client/device telemetry.
   - `chapter.password_reset_tokens`: Manages secure, hashed token lifecycles for password resets.
   - `chapter.auth_rate_limits`: Durable, privacy-preserving IP/identifier counters guarding auth endpoints against brute-force attacks.
   - *Evidence:* repo://src/db/schema.sql#L19-L100
2. **Books & Reading Progression**:
   - Core tables include `books`, `reading_log`, `uploaded_files`, `review_cards`, `weekly_reading_goals`, `reading_rounds`, and `reading_progress_companions`.
   - `chapter.reading_progress_companions`: Stores synthesized reading progress summaries per book and reading round, maintaining JSONB blobs for main threads, converging insights, open threads, and carry-forward state.
   - *Evidence:* repo://src/db/schema.sql#L1-L15 (schema overview), repo://src/db.ts#L189-L196 (verification list), repo://migrations/20260825_add_reading_progress_companions.sql#L1-L3
3. **AI Readers, Podcast & Synthesis**:
   - Specialized tables for AI reader continuity maps, narrative expansions, podcast episodes, podcast recaps, ask-reading Q&A, and cross-book connections.

---

## Migrations System

Schema evolutions are applied via SQL migration files located in the `/migrations/` directory.

- **Naming Convention**: `YYYYMMDD_<description>.sql` (e.g., `20260825_add_reading_progress_companions.sql`).
- **Execution & Integration**: Migration files are executed sequentially during deployment or startup scripts, ensuring transactional safety and incremental schema updates.
- **Representative Migration**: `migrations/20260825_add_reading_progress_companions.sql` creates the `reading_progress_companions` table with cascading foreign keys to `books` and `reading_log`, integrity constraints, and indexes.
  - *Evidence:* repo://migrations/20260825_add_reading_progress_companions.sql#L1-L3

---

## Storage Repositories

Chapter implements dedicated repository modules that encapsulate data access logic for specific domain entities. Repositories accept raw queries via `src/db.ts` and map database rows to strongly-typed TypeScript domain models.

### Notable Repositories
- **Reading Progress Companion Repository (`src/readingProgressCompanionRepository.ts`)**: Manages reads, upserts, and invalidations for companion states across reading rounds.
- **Reading Lens Repository (`src/readingLensRepository.ts`)**: Handles persistence and retrieval of reading lens analyses.
- *Evidence:* repo://src/1-L3 (migrations), repo://src/db.ts#L1-L200 (database core), repo://src/db/schema.sql#L1-L100 (schema initialization).
