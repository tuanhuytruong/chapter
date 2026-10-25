import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const schema = read("src/db/schema.sql");
const migration = read("migrations/20260916_add_reference_playbooks.sql");
const db = read("src/db.ts");

for (const token of [
  "CREATE TABLE IF NOT EXISTS chapter.reference_cards",
  "CREATE TABLE IF NOT EXISTS chapter.reference_card_uses",
  "CHECK (reading_experience IN ('analytical', 'story', 'reference'))",
  "CHECK (card_type IN ('recipe', 'formula', 'procedure'))",
  "UNIQUE (owner_id, request_key)",
  "ON DELETE CASCADE",
  "idx_reference_cards_owner_updated",
  "idx_reference_card_uses_card_time",
  "'reference_card'",
]) {
  if (!schema.includes(token)) throw new Error(`bootstrap schema contract missing: ${token}`);
  if (!migration.includes(token)) throw new Error(`migration contract missing: ${token}`);
}

for (const relation of ["reference_cards", "reference_card_uses", "search_documents"]) {
  if (!db.includes(`"${relation}"`)) throw new Error(`core schema gate missing relation: ${relation}`);
}

const searches = [...schema.matchAll(/search_documents[\s\S]{0,900}/g)].map((match) => match[0]).join("\n");
if (searches.includes("source_excerpt")) {
  throw new Error("search schema must not index raw reference source excerpts");
}

console.log("REFERENCE_PLAYBOOKS_SCHEMA_CONTRACT_OK");
