import assert from "node:assert/strict";
import { formatForecastDate, getReadingForecast } from "../src/readingForecast";

const book = {
  total_pages: 100,
  current_page: 40,
  daily_pages: 5,
  status: "active" as const,
};
const log = (date: string, page_start: number, page_end: number) => ({ date, page_start, page_end });

const observed = getReadingForecast(book, [
  log("2026-08-20", 1, 20),
  log("2026-08-22", 21, 40),
], "2026-08-22");
assert.equal(observed.kind, "observed");
if (observed.kind === "observed") {
  assert.equal(observed.readingDaysLeft, 3);
  assert.equal(observed.completionDate, "2026-08-27");
  assert.equal(formatForecastDate(observed.completionDate), "Aug 27");
}

const sparse = getReadingForecast(book, [log("2026-08-22", 1, 40)], "2026-08-22");
assert.deepEqual(sparse, { kind: "plan", remainingUnits: 60, readingDaysLeft: 12 });

const sameDay = getReadingForecast(book, [
  log("2026-08-22", 1, 20),
  log("2026-08-22", 21, 40),
], "2026-08-22");
assert.equal(sameDay.kind, "plan");

const priorRoundExcluded = getReadingForecast(book, [
  log("2026-07-01", 1, 40),
  log("2026-08-22", 41, 45),
], "2026-08-22");
assert.equal(priorRoundExcluded.kind, "plan");

const epub = getReadingForecast(
  { total_pages: 30, current_page: 10, daily_pages: 3, status: "active" },
  [log("2026-08-20", 1, 5), log("2026-08-23", 6, 10)],
  "2026-08-23",
);
assert.equal(epub.kind, "observed");

assert.deepEqual(
  getReadingForecast({ ...book, current_page: 100, status: "finished" }, [], "2026-08-22"),
  { kind: "unavailable" },
);
assert.deepEqual(
  getReadingForecast({ ...book, daily_pages: 0 }, [], "2026-08-22"),
  { kind: "unavailable" },
);

console.log("READING_FORECAST_FIXTURES_OK");
