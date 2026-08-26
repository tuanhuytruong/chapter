---
type: Quickstart
title: Quickstart
description: Entry point for navigating the wiki and understanding the Chapter repository, its core architecture, and local development.
tags: [quickstart, overview, navigation]
verified:
  - by: openwiki/0.4.0
    at: 2026-08-26T19:17:20.603Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
generated: {by: "openwiki/0.4.0", at: "2026-08-25T17:44:34.504Z"}
---

# Quickstart

Welcome to the **Chapter** repository wiki. This guide provides a fast path to understanding the system architecture, code organization, local setup, testing procedures, and navigation across the wiki pages.

## Repository Overview

**Chapter** is a self-hosted reading companion for maintaining a personal library, recording reading sessions, building a calm source-grounded view of each book over time, and generating private chapter podcasts.

- **Stack**: React 19, Vite, TypeScript, Tailwind CSS (Client); Node.js, Express, TypeScript, PostgreSQL, OpenAI-compatible APIs (Server).
- **Primary Source Entry Points**:
  - Backend server entry: repo://server.ts
  - Client application entry: repo://src/main.tsx or repo://src/App.tsx
  - Database layer: repo://src/db.ts
  - Verification scripts: repo://scripts/

---

## Task-Routing Map

| User Intent / Change Area | Relevant Wiki Page | Source Entry Points | Key Symbols / Components | Focused Verification Scripts |
| :--- | :--- | :--- | :--- | :--- |
| **System Architecture & Server** | [/openwiki/architecture/overview.md](/openwiki/architecture/overview.md) | repo://server.ts, repo://src/App.tsx | Express app, SPA router, Middleware | repo://scripts/verify-platform-db.ts |
| **Database & Migrations** | [/openwiki/architecture/database.md](/openwiki/architecture/database.md) | repo://src/db.ts, repo://migrations/ | `pg`, Connection pool, Migrator | repo://scripts/verify-platform-db.ts |
| **Reading Companions & Synthesis** | [/openwiki/concepts/reading-companions.md](/openwiki/concepts/reading-companions.md) | repo://src/aiReader.ts, repo://src/services/ | Reading Lens, AI Reader, Session summaries | repo://scripts/verify-reading-lens.ts, repo://scripts/verify-ai-reader.ts |
| **API Routes & Backend Handlers** | [/openwiki/integrations/api-routes.md](/openwiki/integrations/api-routes.md) | repo://server.ts | Express Router, Auth, Session endpoints | repo://scripts/verify-review-api.ts |
| **Testing & Verification** | [/openwiki/testing/verification.md](/openwiki/testing/verification.md) | repo://scripts/ | `verify-*` script suites | repo://scripts/verify-phase1.mjs |

---

## Getting Started & Local Development

### 1. Prerequisites
- Node.js 20+ and npm
- PostgreSQL 14+ running locally or accessible via connection string
- An OpenAI-compatible chat completion provider (for summaries, reading companions, and analysis)
- Optional: OpenAI-compatible speech/TTS provider (for chapter podcasts)

### 2. Installation & Configuration
Clone the repository and install dependencies:
```bash
git clone <repository-url> chapter
cd chapter
npm install
```

Copy the environment template and configure `.env.local`:
```bash
cp .env.example .env.local
```

Ensure at least these variables are set in `.env.local`:
```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
NINE_ROUTER_URL=https://<llm-provider>/v1/chat/completions
NINE_ROUTER_MODEL=<model-id>
NINE_ROUTER_API_KEY=<api-key>
SESSION_SECRET=<random-secret>
CHAPTER_BOOKS_DIR=/absolute/path/to/book-storage
PORT=3000
```

### 3. Running Locally
Start the development server (which runs server.ts with `tsx` and hot-reloads):
```bash
npm run dev
```

### 4. Running Verification Scripts
The repository provides focused verification scripts under `scripts/` to validate features and database layers without heavy test frameworks:
```bash
npx tsx scripts/verify-platform-db.ts
npx tsx scripts/verify-ai-reader.ts
npx tsx scripts/verify-reading-lens.ts
```
