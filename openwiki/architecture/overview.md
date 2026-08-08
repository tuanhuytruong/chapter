---
type: Architecture Overview
title: Architecture Overview
description: High-level system architecture of the Chapter repository.
tags: [architecture, overview]
openwiki:
  roles: ["architecture"]
  change_kinds: ["lifecycle"]
  source_paths: ["server.ts", "src/App.tsx"]
  validation_commands: ["npm test"]
---

# Architecture Overview

Chapter is a full-stack reading companion application built with Node.js, Express, React, Vite, and SQLite (via better-sqlite3).

```mermaid
flowchart TD
    Client[React Frontend / Vite] -->|HTTP / API Routes| Server[Express Server /server.ts]
    Server -->|Database Queries| DB[(SQLite Database)]
    Server -->|External LLM / TTS| AI[AI & Podcast Services]
```

- Client: Single-page application in `/src/`, routed via custom views and hooks.
- Server: Express backend in `/server.ts`, handling authentication, reading notes, bookmarks, podcasts, and billing.
- Database: SQLite database configured via migrations in `/migrations/`.
