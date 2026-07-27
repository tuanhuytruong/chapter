/**
 * AI Reader batch job — run nightly via PM2 cron or manually.
 *
 * For each book with an uploaded file:
 *   1. Find reading_log sessions not yet processed
 *   2. Extract text for each session using existing extractor
 *   3. Run chunk analysis (LLM)
 *   4. Synthesise all chunks into updated book_wiki (LLM)
 *
 * Usage:
 *   npx tsx scripts/run-ai-reader.ts
 *   npx tsx scripts/run-ai-reader.ts --book-id <uuid>   # single book
 *   npx tsx scripts/run-ai-reader.ts --force            # reprocess all chunks
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { query, ensureSchema } from "../src/db.js";
import { processBookForWiki } from "../src/aiReader.js";

const args = process.argv.slice(2);
const targetBookId = args.includes("--book-id") ? args[args.indexOf("--book-id") + 1] : null;
const forceReprocess = args.includes("--force");

async function main() {
  await ensureSchema();
  console.log(`[ai-reader] Starting${forceReprocess ? " (force reprocess)" : ""}${targetBookId ? ` for book ${targetBookId}` : " for all books"}`);

  if (targetBookId) {
    const updated = await processBookForWiki(targetBookId, forceReprocess);
    console.log(`[ai-reader] Done. Wiki updated: ${updated}`);
    process.exit(0);
  }

  // Fetch books that have an uploaded file
  const { rows: books } = await query(
    `SELECT id FROM books
     WHERE file_path IS NOT NULL AND file_path != ''
     ORDER BY created_at ASC`
  );

  console.log(`[ai-reader] Found ${books.length} book(s) with uploaded files`);

  let totalWikisUpdated = 0;

  for (const book of books) {
    try {
      const updated = await processBookForWiki(book.id, forceReprocess);
      if (updated) totalWikisUpdated++;
    } catch (err: any) {
      console.error(`[ai-reader] Failed for book ${book.id}: ${err.message}`);
    }
  }

  console.log(`[ai-reader] Done. Wikis updated: ${totalWikisUpdated}/${books.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[ai-reader] Fatal:", err);
  process.exit(1);
});
