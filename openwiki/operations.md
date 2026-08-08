---
type: Operations
title: Operations & Runbooks
description: Deployment, monitoring, and operational runbooks for Chapter.
tags: [operations, runbook]
openwiki:
  roles: ["operations"]
  change_kinds: ["lifecycle"]
  source_paths: ["ecosystem.config.cjs", "server.ts"]
  validation_commands: ["npm test"]
---

# Operations & Runbooks

- **Deployment**: Managed via PM2 using `/ecosystem.config.cjs`.
- **Server Startup**: `npm start` runs `/server.ts`.
- **Health Checks**: Verified via platform validation scripts in `/scripts/`.
