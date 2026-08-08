---
type: Quickstart
title: Quickstart
description: Getting started with the OpenWiki code knowledge base for Chapter.
tags: [quickstart, overview]
openwiki:
  roles: [architecture, repository]
  change_kinds: [lifecycle]
  source_paths: [README.md]
  validation_commands: ["npm test"]
---

# Quickstart

Welcome to the **Chapter** repository OpenWiki knowledge base. This wiki documents the architecture, key workflows, data models, operations, testing guidance, and integration points for the Chapter codebase.

## Task Routing Table

| Change Area / User Intent | Relevant Wiki Page | Source Entry Points | Important Symbols / Types | Focused Tests | Minimal Validation Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Architecture Overview** | [Architecture Overview](/openwiki/architecture/overview.md) | `/server.ts`, `/src/App.tsx` | `Server`, `App` | `/scripts/verify-platform-db.ts` | `npm test` |
| **Workflows & Reading Engine** | [Workflows](/openwiki/workflows.md), [Reading Engine](/openwiki/reading-engine.md) | `/src/aiReader.ts`, `/src/pages/Today.tsx` | `aiReader`, `Today` | `/scripts/verify-ai-reader.ts` | `npm test` |
| **Data Models & Database** | [Data Model](/openwiki/data-model.md) | `/src/db.ts`, `/src/db/schema.sql` | `db`, `schema` | `/scripts/verify-platform-db.ts` | `npm test` |
| **Operations & Runbooks** | [Operations](/openwiki/operations.md) | `/server.ts`, `/ecosystem.config.cjs` | `server`, `pm2` | `/scripts/verify-platform-headers.ts` | `npm test` |
| **Testing & Verification** | [References](/openwiki/references.md) | `/scripts/` | `verify-*` | `/scripts/verify-today-insights-markdown.ts` | `npm test` |

## Major Sections

- [Architecture Overview](/openwiki/architecture/overview.md)
- [Architecture Index](/openwiki/architecture/index.md)
- [Workflows](/openwiki/workflows.md)
- [Reading Engine](/openwiki/reading-engine.md)
- [Data Model](/openwiki/data-model.md)
- [Operations](/openwiki/operations.md)
- [References](/openwiki/references.md)

## Backlog

- *None at this time.* All core systems are documented.
