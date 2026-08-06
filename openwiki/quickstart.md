---
type: Concept
title: Chapter — AI Daily Book Reading Companion
description: Self-hosted web app for book library management, daily reading tracking, and AI-generated summaries delivered via Telegram. Full-stack TypeScript with React 19, Express, PostgreSQL, and LLM integration.
tags: [quickstart, overview, documentation]
---

# Chapter — AI Daily Book Reading Companion

**Chapter** is a self-hosted web app that manages a personal book library, tracks daily reading progress book-by-book, and automatically generates AI-powered summaries via a cron job (n8n) pushed to Telegram every morning.

**Stack:** Vite + React 19 + TypeScript (frontend) · Express + TypeScript (backend) · PostgreSQL · 9router / Qwen3 (LLM) · n8n · Telegram Bot

## Quick start

```bash
git clone <repo>
cd chapter
cp .env.example .env.local          # fill in DATABASE_URL, LLM URL, Telegram token
npm install
npm run dev                          # starts server at http://localhost:3000
```

The server auto-creates the `chapter` schema tables on boot. Visit `http://localhost:3000`, create an account, upload a book (PDF/EPUB), and start reading.

> **Production deploy:** See [Operations](operations.md).

## Features

- **Library** — grid of book cards with cover, progress bar, streak, and status badges
- **Filter + Sort + Search** — All / Active / Finished / Paused; sort by recent, title, progress, streak
- **Book Detail** — reading-log timeline, GitHub-style streak heatmap, expandable raw text, edit/delete
- **AI Daily Summary** — extract next chunk (PDF/EPUB) → LLM → save summary, key insights, quote
- **Podcasts** — AI-generated audio summaries delivered via Telegram
- **Multi-user** — shelf-per-user with optional "All Readers" view, Telegram account linking
- **Five analysis modes**:
  - [Casual](reading-engine.md#casual-mode-summary_mode--casual) — warm 3–5 sentence narrative summary
  - [Deep Reading](reading-engine.md#deep-reading-mode-summary_mode--deep_reading) — structured section-by-section analysis
  - [Reading Lens](reading-engine.md#reading-lens-analysis-srcreadinglensts) — argument mapping for non-fiction (analytical)
  - [Story Thread](reading-engine.md#story-thread-analysis-srcstorythreadts) — character/plot tracking for fiction
<!-- openwiki: broken internal link [reading-engine.md#ai-reader--book-wiki-synthesis-srcreaderts] heading anchor "ai-reader--book-wiki-synthesis-srcreaderts" does not exist in "reading-engine.md". Fix the href or restore the target, then delete this comment. -->
  - [AI Reader Wiki](reading-engine.md#ai-reader--book-wiki-synthesis-srcreaderts) — batch pipeline synthesises a persistent book wiki (concepts, themes, character maps, narrative arc)
- **Reading Rhythm** — streak tracking with milestone titles (3, 7, 14, 30, 100 days), 14-day heatmap data
- **Today Dashboard** — view active book, weekly goal, due reviews at a glance
- **Spaced-Repetition Reviews** — review key insights on an expanding schedule (1–3–7–14–30 days)
- **Achievements** — 10 gamification milestones (streaks, pages, insights)
- **Weekly Goals** — track sessions or units per Monday–Sunday week
- **Reading Momentum** — consistency, velocity, and intensity composite score
- **Reading Queue** — queue books and start them in order
- **Read All Today** — bulk-advance all active books in one click
- **Telegram Delivery** — n8n cron (07:00) advances books and pushes summaries to Telegram
- **Telegram Account Linking** — secure deep-link flow to bind your chat to your account
- **Membership preview** — `/pricing` shows Free, Reader Plus, and Deep Reader plans; checkout is not open and current reading behavior is unchanged
- **Multi-user** — shelf-per-user with optional "All Readers" view
- **Auto Cover** — fetch book cover from Open Library when adding a book
- **Avatar system** — 8 animal avatar presets (otter, red-panda, cat, rabbit, panda, bear, koala, penguin)

## Documentation sections

| Section | Description |
|---------|-------------|
| [Architecture Overview](architecture/overview.md) | System architecture, server, frontend, LLM, n8n, data flow diagrams |
| [Data Model](data-model.md) | PostgreSQL schema — books, reading_log, analysis tables, migrations |
| [Reading Engine](reading-engine.md) | PDF/EPUB extraction, LLM integration, analysis modes |
| [Workflows](workflows.md) | n8n cron workflow, Telegram delivery, account linking |
| [Operations](operations.md) | Deployment, environment, build, PM2, verification scripts |

## Key source layout

```
chapter/
├── server.ts                   # Express entry — API routes + session + auth
├── src/
│   ├── routes/books.ts         # All book + reading-engine API routes (~900 lines)
│   ├── routes/reviews.ts       # Spaced-repetition review API
│   ├── routes/upload.ts        # Book file upload endpoint
│   ├── db.ts                   # PostgreSQL pool + query + schema bootstrap
│   ├── db/schema.sql           # Full schema (books, reading_log, users, etc.)
│   ├── extractor.ts            # PDF (pdf-parse) + EPUB text extraction
│   ├── llm.ts                  # 9router LLM client + summary parser
│   ├── readingLens.ts          # Reading Lens prompts + parser
│   ├── storyThread.ts          # Story Thread prompts + parser + state merge
│   ├── telegram.ts             # Telegram push + message formatting
│   ├── telegram-link.ts        # Deep link token generation + parsing
│   ├── auth.ts                 # Session-based auth middleware
│   ├── review.ts               # Spaced repetition interval logic
│   ├── achievements.ts         # Gamification milestone evaluation
│   ├── weekly-goal.ts          # Weekly goal tracking
│   ├── calendar.ts             # Calendar date utilities
│   ├── aiReader.ts             # AI Reader batch analysis + wiki synthesis
│   ├── readingLensRepository.ts # Reading Lens DB access
│   ├── readingUnits.ts         # Unit label formatting helpers
│   ├── reading-rhythm.ts       # Reading streak + milestone calculation
│   ├── types.ts                # Shared TypeScript types
│   ├── App.tsx                 # React router + layout
│   ├── api.ts                  # Frontend API client
│   ├── pages/                  # Library, BookDetail, Today, Insights, etc.
│   └── components/             # BookCard, DaySummary, JourneyDrawer, etc.
├── n8n/chapter-daily-summary.json  # n8n workflow import
├── scripts/                    # Verification + user management + AI Reader run scripts
├── migrations/                 # SQL migration files (10)
├── .github/workflows/          # CI — OpenWiki daily update workflow
├── ecosystem.config.cjs        # PM2 config
└── update.sh                   # Deploy script
```

## Project history

Built over ~12 days (July 15–26, 2026) by a single developer + AI agent. The repository has 130+ commits on a linear `dev` branch, rapidly evolving from core backend through multi-user support, AI analysis modes, Telegram integration, gamification, AI Reader wiki synthesis, and polish.

## Backlog

<!-- openwiki: broken internal link [../docs/BRAINSTORM.md] file "../docs/BRAINSTORM.md" does not exist. Fix the href or restore the target, then delete this comment. -->
The [BRAINSTORM.md](../docs/BRAINSTORM.md) document records ideas for future enhancements, including:
- **Reading Momentum Score** (already partially implemented as `MomentumScore` component)
- **Cross-book Insight Clusters** — theme clustering across books using embeddings
- **AI Book Recommender** — recommendations based on finished-book summaries
- **Reading Ritual notifications** — daily quote + call-to-action via Telegram
- **Book Duel comparison** — side-by-side finished-book analysis
- **Highlight extraction** — paste user highlights alongside AI summaries
- **Reading Forecast** — projected finish date based on actual pace
- **Journey Chapter Arc** — story-arc SVG visualization
- **Book Club Mode** — shared reading sync between users
- **Reading DNA Card** — exportable shareable reading summary card
