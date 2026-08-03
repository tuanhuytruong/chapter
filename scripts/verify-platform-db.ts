import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const db = read("src/db.ts");
const config = read("src/config.ts");
const books = read("src/routes/books.ts");

for (const token of [
  "withBackgroundTransaction",
  "statement_timeout",
  "lock_timeout",
  "set_config",
  "timedQuery",
  "duration_ms=",
]) {
  if (!db.includes(token)) throw new Error(`DB timeout contract missing: ${token}`);
}
if (db.includes("options: \"-c search_path=chapter -c statement_timeout")) {
  throw new Error("bootstrap must not inherit request statement timeout");
}
for (const token of [
  "DB_REQUEST_STATEMENT_TIMEOUT_MS",
  "DB_BACKGROUND_STATEMENT_TIMEOUT_MS",
]) {
  if (!config.includes(token)) throw new Error(`DB config missing: ${token}`);
}
if (!books.includes("INSERT_BATCH_SIZE = 500") || !books.includes("VALUES ${values.join")) {
  throw new Error("EPUB unit insert must use bounded multi-row batches");
}
console.log("PLATFORM_DB_CONTRACT_OK");
