---
type: Quickstart
title: Quickstart
description: Entry point and navigation guide for the OpenWiki documentation.
tags: [quickstart, documentation, overview]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-15T20:14:22.648Z
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
generated: { by: "openwiki/0.5.2", at: "2026-09-15T20:14:22.648Z" }
---

# Quickstart

Welcome to the OpenWiki documentation. This page serves as the entry point for understanding the repository, its architecture, and development workflows.

## Overview
OpenWiki provides a structured approach to documenting complex repositories. This documentation covers the system's architecture, development practices, and testing strategies.

## Navigation & Architecture Map
Use the following documentation domains to understand and navigate the system:

* **[Architecture Overview](/openwiki/architecture/overview.md)**: High-level architectural design and component relationships.
* **[Backend Architecture](/openwiki/architecture/backend.md)**: Details on the backend server structure, API routes, and service integration.
* **[Database Architecture](/openwiki/architecture/database.md)**: Overview of the data layer, including schema design and management.
* **[Workflow Overview](/openwiki/workflows/overview.md)**: Centralized guidance on development, deployment, and task-based workflows.
* **[Testing Overview](/openwiki/testing/overview.md)**: Strategy and procedures for testing and system verification.

## Adding Documentation
To add or update documentation:
1. Identify the relevant domain under the `/openwiki/` directory.
2. If adding a new page, ensure it includes appropriate YAML frontmatter (type, title, description, tags).
3. Use repository-relative links (e.g., `repo://path/to/file`) when citing source evidence.
4. Follow the established structure to maintain consistency across the wiki.
