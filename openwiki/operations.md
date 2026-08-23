---
type: Operations
title: Operations & Runbooks
description: Deployment, monitoring, and operational runbooks for Chapter.
tags: [operations, runbook]
openwiki:
  roles: ["operations"]
  change_kinds: ["lifecycle"]
  source_paths: ["ecosystem.config.cjs", "server.ts", "scripts/user-lifecycle-report.sql"]
  validation_commands: ["npm test"]
---

# Operations & Runbooks

- **Deployment**: Managed via PM2 using `/ecosystem.config.cjs`.
- **Server Startup**: `npm start` runs `/server.ts`.
- **User Lifecycle & Reporting**: Periodic analysis and user tracking reports via `/scripts/user-lifecycle-report.sql` and lifecycle event tables (`/migrations/20260823_add_user_lifecycle_tracking.sql`).
- **Health Checks & Verification**: Verified via platform validation scripts in `/scripts/`, such as `/scripts/verify-platform-db.ts` and `/scripts/verify-platform-headers.ts`.

Related concepts: [Architecture Overview](/openwiki/architecture/overview.md), [Data Model](/openwiki/data-model.md).
