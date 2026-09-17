---
type: Quickstart
title: Quickstart
description: Entry point and navigation guide for the Chapter reading companion repository.
tags: [quickstart, documentation, overview]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-17T20:19:11.636Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-af559fee7f56cc7abf2bba79
    resource: repo://server.ts
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
generated: { by: "openwiki/0.5.2", at: "2026-09-17T20:19:11.636Z" }
---

# Quickstart

Welcome to the Chapter documentation. This page serves as the entry point for understanding the repository, its architecture, and development workflows for this self-hosted reading companion.

## Overview

Chapter is a self-hosted reading companion built with React 19, Vite, TypeScript, Express, PostgreSQL, and OpenAI-compatible LLM/TTS providers. This documentation covers the system's architecture, development practices, and testing strategies.

## Getting Started

To set up the project locally:

1. **Install Dependencies**: Run the package installation command:
   ```bash
   npm install
   ```

2. **Run the Development Server**: The application uses `tsx` to serve the backend.
   ```bash
   npm run dev
   ```

3. **Platform Verification**: The repository includes a suite of focused verification scripts in the `/scripts/` directory, such as `verify-platform-db.ts` and `verify-ai-reader.ts`, to ensure platform health and test functionality. You can run these using `npm run`, for example:
   ```bash
   npm run verify:platform-db
   npm run verify:ai-reader
   ```

## Entry Points

* **Backend**: The primary entry point for the Express backend is `repo://server.ts`.
* **Frontend**: The frontend application is initialized via `repo://src/main.tsx`, which renders the root `repo://src/App.tsx`.

## Navigation & Architecture Map

Use the following documentation domains to navigate the system:

* **[Architecture Overview](/openwiki/architecture/overview.md)**: High-level architectural design and component relationships.
* **[Backend Architecture](/openwiki/architecture/backend.md)**: Details on the backend server structure, API routes, and service integration.
* **[Database Architecture](/openwiki/architecture/database.md)**: Overview of the data layer, including schema design and management.
* **[Workflow Overview](/openwiki/workflows/overview.md)**: Centralized guidance on development, deployment, and task-based workflows.
* **[Testing Overview](/openwiki/testing/testing-guide.md)**: Strategy and procedures for testing and system verification.

## Adding Documentation

To add or update documentation:
1. Identify the relevant domain under the `/openwiki/` directory.
2. If adding a new page, ensure it includes appropriate YAML frontmatter (type, title, description, tags).
3. Use repository-relative links (e.g., `repo://path/to/file`) when citing source evidence.
4. Follow the established structure to maintain consistency across the wiki.
