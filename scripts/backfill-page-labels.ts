/**
 * Backfill book_reading_units.page_label for existing EPUB books.
 *
 * For each EPUB book that already has reading units, reopen the uploaded
 * EPUB, rebuild the units with the extractor (which derives the printed page
 * number from the spine filename, e.g. page0042.xhtml -> 42), then UPDATE
 * page_label on the stored units by unit_index (1-based, stable spine order).
 * PDF books have no units table rows and are skipped.
 *
 * Usage:
 *   npx tsx scripts/backfill-page-labels.ts            # all EPUB books
 *   npx tsx scripts/backfill-page-labels.ts --book-id <uuid>
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { query } from "../src/db.js";
import { buildEpubReadingUnits } from "../src/extractor.js";

const args = process.argv.slice(2);
const targetBookId = args.includes("--book-id")
  ? args[args.indexOf("--book-id") + 1]
  : null;

async function main() {
  const params = targetBookId ? [targetBookId] : [];
  const { rows: books } = await query(
    `SELECT id, title, file_path,
        (SELECT count(*) FROM book_reading_units u WHERE u.book_id = books.id) AS units
     FROM books
     WHERE file_type = 'epub' AND file_path IS NOT NULL AND file_path != ''
       AND EXISTS (SELECT 1 FROM book_reading_units u WHERE u.book_id = books.id)
     ${targetBookId ? "AND id = $1" : ""}
     ORDER BY created_at ASC`,
    params,
  );

  let totalUpdated = 0;
  let labelledBooks = 0;
  for (const book of books) {
    try {
      const rebuilt = await buildEpubReadingUnits(book.file_path);
      if (!rebuilt.length) {
        console.warn(`[backfill] ${book.id} ${book.title}: EPUB produced no units — skipped`);
        continue;
      }
      let updated = 0;
      let labelled = 0;
      for (const unit of rebuilt) {
        if (unit.pageLabel == null) continue;
        const res = await query(
          `UPDATE book_reading_units SET page_label = $1
           WHERE book_id = $2 AND unit_index = $3
           RETURNING unit_index`,
          [unit.pageLabel, book.id, unit.unitIndex],
        );
        if (res.rowCount > 0) { updated++; labelled++; }
      }
      totalUpdated += updated;
      if (labelled > 0) labelledBooks++;
      console.log(
        `[backfill] ${book.id} ${book.title}: ${updated}/${rebuilt.length} units labelled` +
        (updated === 0 ? " (no page info in this EPUB)" : ""),
      );
    } catch (error: any) {
      console.warn(`[backfill] ${book.id} ${book.title}: ${error?.message ?? error}`);
    }
  }

  console.log(
    `[backfill] done. ${labelledBooks}/${books.length} books carry printed page labels; ${totalUpdated} units updated.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("[backfill] failed", error);
  process.exit(1);
});