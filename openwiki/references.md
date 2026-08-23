---
type: References
title: References & Testing
description: Test verification scripts and reference documentation for Chapter.
tags: [testing, references]
openwiki:
  roles: ["testing"]
  change_kinds: ["lifecycle"]
  source_paths: ["scripts/"]
  validation_commands: ["npm test"]
---

# References & Testing

Verification scripts under `/scripts/` ensure platform integrity across features such as AI reading, memberships, billing, and UI components:
- `/scripts/verify-platform-db.ts`
- `/scripts/verify-ai-reader.ts`
- `/scripts/verify-today-insights-markdown.ts`
- `/scripts/confirm-vietqr-payment.ts`
- `/scripts/verify-entitlements.ts`

Related concepts: [Quickstart](/openwiki/quickstart.md), [Operations](/openwiki/operations.md).
