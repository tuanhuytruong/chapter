---
type: Quickstart & Task Routing Map
title: Quickstart & Task Routing Map
description: High-level navigation, repository overview, and task-routing map for Chapter - an advanced book tracking and reading intelligence platform.
tags: [quickstart, documentation, overview, navigation, architecture, workflows]
verified:
  - by: openwiki/0.4.3
    at: 2026-08-29T00:58:11.655Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
generated: { by: "openwiki/0.4.3", at: "2026-08-29T00:58:11.655Z" }
---

# Quickstart & Task Routing Map

Welcome to the **Chapter** documentation quickstart and task routing map. Chapter is an advanced book tracking and reading intelligence platform designed for maintaining a personal library, recording reading sessions, and building a calm, source-grounded view of each book over time.

This page provides a high-level navigation guide, repository overview, top-level directory layout, key entrypoints, and routing map across the OpenWiki documentation.

## Repository Overview

Chapter is a self-hosted reading companion built with React 19, Vite, TypeScript, Express, PostgreSQL, and OpenAI-compatible LLM/TTS providers. It supports PDF and EPUB books, session summaries, reading continuity tools, private chapter podcasts, and optional Telegram delivery.

### Key Entrypoints & Directory Layout

- **Backend Server Entrypoint**: `repo://server.ts` — Express application, middleware configuration, API route registration, and static asset serving.
- **Frontend Entrypoint**: `repo://src/main.tsx` and `repo://src/App.tsx` — React 19 root initialization, routing setup, and client-side application state.
- **Database Layer**: `repo://src/db.ts` — PostgreSQL connection pool management, schema auto-migration, and query execution utilities.
- **Verification & Testing Scripts**: `repo://scripts/` — Focused TypeScript verification scripts (e.g., `verify-platform-db.ts`, `verify-ai-reader.ts`, `verify-reading-lens.ts`) used for robust automated testing and platform health checks.
- **Package Configuration**: `repo://package.json` — Dependency declarations, build scripts, and verification tasks.

## Documentation Navigation & Task-Routing Map

Use the following routing map to navigate the OpenWiki documentation according to your current task:

| Topic / Domain | Target Wiki Page | Description & Key Contents |
| :--- | :--- | :--- |
| **System Architecture** | [/openwiki/architecture/overview.md](/openwiki/architecture/overview.md) | Comprehensive system architecture, backend server layout, frontend components, and data storage. |
| **Database Schema** | [/openwiki/database/schema.md](/openwiki/database/schema.md) | PostgreSQL database schema documentation, migrations, and table relationships. |
| **Analytics & Forecast** | [/openwiki/integrations/analytics-and-forecast.md](/openwiki/integrations/analytics-and-forecast.md) | Analytics integration, Posthog identity management, and reading forecast features. |
| **Testing & Verification** | [/openwiki/testing/verification.md](/openwiki/testing/verification.md) | Focused verification scripts, testing guidance, and platform health verification procedures. |
| **Reading Workflows** | [/openwiki/workflows/reading-markers.md](/openwiki/workflows/reading-markers.md) | End-to-end user and system workflows for reading markers, session summaries, and reading lenses. |

## Local Development & Verification Quickstart

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env.local` and populate required variables such as `DATABASE_URL`, `NINE_ROUTER_URL`, `NINE_ROUTER_MODEL`, `NINE_ROUTER_API_KEY`, `SESSION_SECRET`, and `CHAPTER_BOOKS_DIR`.

3. **Run Locally**:
   ```bash
   npm run dev
   ```
   The development server starts via `tsx server.ts` on port 3000 (or configured `PORT`), automatically verifying and establishing database schemas on boot.

4. **Run Verification Scripts**:
   Verify platform health and specific feature subsystems using package scripts:
   ```bash
   npx tsx scripts/verify-platform-db.ts
   npx tsx scripts/verify-ai-reader.ts
   ```
