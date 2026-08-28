---
type: Quickstart
title: Quickstart
description: Quickstart guide and navigation map for the OpenWiki documentation.
tags: [quickstart, documentation, overview, navigation]
verified:
  - by: openwiki/0.4.3
    at: 2026-08-28T01:29:33.698Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
generated: { by: "openwiki/0.4.3", at: "2026-08-28T01:29:33.698Z" }
---

# Quickstart

Welcome to the **Chapter** documentation quickstart and navigation map. This page provides an entrypoint to the core architecture, concepts, workflows, operations, integrations, and testing guides in the OpenWiki wiki.

## Repository Overview

**Chapter** is a self-hosted reading companion built with React 19, Vite, TypeScript, Express, PostgreSQL, and OpenAI-compatible LLM/TTS providers.

- **Primary Entry Points**:
  - Backend server: repo://server.ts
  - Frontend application: repo://src/App.tsx
  - Database layer: repo://src/db.ts
  - Verification scripts: repo://scripts/

## Wiki Navigation Map

Explore the major documentation domains:

| Domain | Description | Key Wiki Pages |
| :--- | :--- | :--- |
| **Architecture** | System layout, frontend, backend, and database storage. | [/openwiki/architecture/overview.md](/openwiki/architecture/overview.md), [/openwiki/architecture/frontend.md](/openwiki/architecture/frontend.md), [/openwiki/architecture/backend.md](/openwiki/architecture/backend.md), [/openwiki/architecture/database.md](/openwiki/architecture/database.md) |
| **Concepts** | Core domain entities, reading companions, and reading engines. | [/openwiki/concepts/index.md](/openwiki/concepts/index.md), [/openwiki/concepts/domain-model.md](/openwiki/concepts/domain-model.md), [/openwiki/concepts/reading-companions.md](/openwiki/concepts/reading-companions.md) |
| **Workflows** | End-to-end operational flows, authentication, and content processing. | [/openwiki/workflows/index.md](/openwiki/workflows/index.md), [/openwiki/workflows/auth.md](/openwiki/workflows/auth.md), [/openwiki/workflows/content-processing.md](/openwiki/workflows/content-processing.md) |
| **Operations** | Deployment, configuration, and verification script guides. | [/openwiki/operations/index.md](/openwiki/operations/index.md), [/openwiki/operations/verification-scripts.md](/openwiki/operations/verification-scripts.md) |
| **Integrations** | API routes, external LLM/TTS providers, and external services. | [/openwiki/integrations/index.md](/openwiki/integrations/index.md), [/openwiki/integrations/api-routes.md](/openwiki/integrations/api-routes.md) |
| **Testing** | Verification suites, test runners, and QA methodology. | [/openwiki/testing/index.md](/openwiki/testing/index.md), [/openwiki/testing/overview.md](/openwiki/testing/overview.md), [/openwiki/testing/verification.md](/openwiki/testing/verification.md) |

## Local Development Quickstart

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Configure Environment**:
   Copy `.env.example` to `.env.local` and populate required variables (`DATABASE_URL`, `NINE_ROUTER_URL`, etc.).
3. **Run Development Server**:
   ```bash
   npm run dev
   ```
4. **Run Verification Scripts**:
   ```bash
   npx tsx scripts/verify-platform-db.ts
   npx tsx scripts/verify-ai-reader.ts
   ```
