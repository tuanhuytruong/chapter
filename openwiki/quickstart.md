---
type: concept
title: Quickstart
description: Central entry point for navigating the Chapter repository, including architecture, workflows, and development environment setup.
tags: [quickstart, overview, development]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-24T20:28:57.073Z
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
generated: { by: "openwiki/0.6.0", at: "2026-09-24T20:28:57.073Z" }
---

# Quickstart

Welcome to the Chapter repository, a self-hosted reading companion. This documentation provides a central entry point for developers to understand the repository structure, core systems, and common development tasks.

## Getting Started

### Development Environment
The project uses a standard Node.js development stack:
1. **Install Dependencies**: `npm install`
2. **Development Server**: `npm run dev` (uses `tsx` for the Express backend).

### System Verification
The repository provides verification scripts to ensure platform health. These are found in the `package.json` scripts section and exercise key system integrations:
* `npm run verify:platform-db`: Tests database connectivity and migrations.
* `npm run verify:ai-reader`: Validates the integration with configured LLM/TTS providers.

## Key Entry Points
* **Backend**: The Express server is initialized at `repo://server.ts`.
* **Frontend**: The client application roots at `repo://src/main.tsx` and `repo://src/App.tsx`.

## System Documentation Roadmap

Use the following domains to navigate the architecture, workflows, and operational procedures:

### Architectural Foundations
* **[Architecture Overview](/openwiki/architecture/overview.md)**: High-level system design and component relationships.
* **[Backend Architecture](/openwiki/architecture/backend.md)**: Details on the backend server, API integration, and service structure.
* **[Frontend Architecture](/openwiki/architecture/frontend.md)**: Describes the React-based frontend application structure.
* **[Domain Model](/openwiki/concepts/domain-model.md)**: Vocabulary and core domain objects.

### Operational & Development Workflows
* **[Workflows Overview](/openwiki/workflows/overview.md)**: Roadmaps for key functional workflows.
* **[Content Processing](/openwiki/workflows/content-processing.md)**: Lifecycle of content within the system.
* **[Testing Overview](/openwiki/testing/overview.md)**: Strategy and procedures for system verification and testing.
* **[Integrations Overview](/openwiki/integrations/overview.md)**: How the system interfaces with external services.
* **[Database Operations](/openwiki/operations/database.md)**: Runbooks for database management and maintenance.
