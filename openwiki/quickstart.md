---
type: Quickstart & Task Routing Map
title: Quickstart & Navigation
description: Core quickstart, repository navigation, local setup, and task-routing map for Chapter - an advanced book tracking and reading intelligence platform.
tags: [quickstart, documentation, overview, navigation, architecture, workflows]
verified:
  - by: openwiki/0.5.0
    at: 2026-09-05T16:00:46.565Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
generated: { by: "openwiki/0.5.0", at: "2026-09-05T16:00:46.565Z" }
---

# Quickstart & Navigation

Welcome to the **Chapter** documentation quickstart and navigation guide. Chapter is a self-hosted reading companion built with React 19, Vite, TypeScript, Express, PostgreSQL, and OpenAI-compatible LLM/TTS providers. It supports PDF and EPUB books, session summaries, reading continuity tools, private chapter podcasts, and optional Telegram delivery.

This page provides a high-level navigation guide, repository overview, top-level directory layout, local setup instructions, key entrypoints, and routing map across the OpenWiki documentation.

## Repository Overview

Chapter is a self-hosted reading companion built with React 19, Vite, TypeScript, Express, PostgreSQL, and OpenAI-compatible LLM/TTS providers.

### Key Entrypoints & Directory Layout

- **Backend Server Entrypoint**: `repo://server.ts` — Express application, middleware configuration, API route registration, and static asset serving.
- **Frontend Entrypoint**: `repo://src/main.tsx` and `repo://src/App.tsx` — React 19 root initialization, routing setup, and client-side application state.
- **Database Layer**: `repo://src/db.ts` — PostgreSQL connection pool management, schema auto-migration, and query execution utilities.
- **Verification & Testing Scripts**: `repo://scripts/` — Focused TypeScript verification scripts (e.g., `verify-platform-db.ts`, `verify-ai-reader.ts`) used for robust automated testing and platform health checks.
- **Package Configuration**: `repo://package.json` — Dependency declarations, build scripts, and verification tasks.

## Documentation Navigation & Task-Routing Map

Use the following routing map to navigate the OpenWiki documentation according to your current task:

| Topic / Domain | Target Wiki Page | Description & Key Contents |
| :--- | :--- | :--- |
| **System Architecture** | [/openwiki/architecture/overview.md](/openwiki/architecture/overview.md) | Comprehensive system architecture, backend server layout, frontend components, and data storage. |
| **Database Schema** | [/openwiki/database/schema.md](/openwiki/database/schema.md) | PostgreSQL database schema documentation, migrations, and table relationships. |
| **Database Operations** | [/openwiki/operations/database.md](/openwiki/operations/database.md) | Runbook for database operations, migrations, and environment setup. |
| **Testing & Verification** | [/openwiki/testing/testing-guide.md](/openwiki/testing/testing-guide.md) | Focused verification scripts, testing guidance, and platform health verification procedures. |
| **Reading Workflows** | [/openwiki/workflows/reading-sessions.md](/openwiki/workflows/reading-sessions.md) | End-to-end reading session lifecycle and text extraction workflow. |
| **Podcasts & Audio** | [/openwiki/integrations/llm-tts.md](/openwiki/integrations/llm-tts.md) | Chapter podcast generation, narration, and audio workflows. |
| **LLM & TTS Integrations** | [/openwiki/integrations/llm-tts.md](/openwiki/integrations/llm-tts.md) | LLM and TTS provider integration details. |

## Local Development, Installation & Production Build

### 1. Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (running locally or accessible via connection string)

### 2. Installation & Configuration
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd chapter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Populate required variables in `.env.local` such as:
   - `DATABASE_URL` (e.g., `postgresql://postgres:postgres@localhost:5432/chapter`)
   - `NINE_ROUTER_URL`, `NINE_ROUTER_MODEL`, `NINE_ROUTER_API_KEY`
   - `SESSION_SECRET`

### 3. Running Locally
Start the development server:
```bash
npm run dev
```
The server starts via `tsx server.ts` on port 3000, automatically verifying and establishing database schemas on boot.

### 4. Building for Production
To build the application for production deployment:
```bash
npm run build
```
Start the production server with:
```bash
npm start
```

### 5. Running Verification Scripts
Verify platform health using package scripts:
```bash
npm run verify:db
npm run verify:ai
```
These scripts call the internal files in `repo://scripts/`.
