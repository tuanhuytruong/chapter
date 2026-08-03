import { readFileSync } from "node:fs";

const sql = readFileSync("migrations/20260801_add_podcast_recaps.sql", "utf8");
for (const token of [
  "CREATE TABLE IF NOT EXISTS chapter.podcast_recaps",
  "owner_id UUID",
  "request_key TEXT",
  "output_language TEXT",
  "podcast_recaps_status_check",
  "UNIQUE (owner_id)",
  "local_cache_path",
]) {
  if (!sql.includes(token)) throw new Error(`missing schema token: ${token}`);
}
if (sql.includes("raw_text") || sql.includes("ai_reader_chunks")) {
  throw new Error("schema must not embed source text");
}
console.log("PODCAST_RECAP_SCHEMA_FIXTURES_OK");

const bootstrap = readFileSync("src/db/schema.sql", "utf8");
if (!bootstrap.includes("chapter.podcast_recaps")) {
  throw new Error("bootstrap schema missing recap table");
}
console.log("PODCAST_RECAP_BOOTSTRAP_FIXTURES_OK");
     