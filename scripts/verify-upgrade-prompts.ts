#!/usr/bin/env node
import { upgradePromptFixtureCheck } from "../src/upgrade-prompts.js";

try {
  upgradePromptFixtureCheck();
  process.exit(0);
} catch (error: any) {
  console.error("[verify-upgrade-prompts] FAILED:", error.message);
  process.exit(1);
}
