import { readFileSync } from "node:fs";

const sql = readFileSync("migrations/20260801_add_cross_book_connections.sql", "utf8");
for (const token of [
  "CREATE TABLE IF NOT EXISTS chapter.cross_book_connections",
  "UNIQUE (owner_id)",
  "source_book_count",
  "source_session_count",
  "idx_cross_book_connections_owner_generated",
]) {
  if (!sql.includes(token)) throw new Error(`missing schema token: ${token}`);
}
console.log("CROSS_BOOK_CONNECTIONS_SCHEMA_FIXTURES_OK");
