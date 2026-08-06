import { query } from "./db.js";

// Listening rhythm — twin-track view of reading vs listening activity.
// Raw aggregates come from the DB; buildListenRhythm() stays pure so it can be
// unit-tested (pg-mem) without a live session or HTTP call.

export type RhythmBookItem = {
  book_id: string;
  title: string;
  reading_round: number;
  episodes_total: number;
  episodes_listened: number;
};

export type ListenDay = { day: string; episodes: number; seconds: number };

export type ListenRhythm = {
  reading_days: string[];
  listening_days: string[];
  listening_episodes_total: number;
  total_listen_seconds: number;
  listen_by_day: ListenDay[];
  books: RhythmBookItem[];
};

type RoundedRow = { book_id: string; reading_round: number };

export function buildListenRhythm(opts: {
  readingDays: string[];
  listeningDays: string[];
  episodeTotals: (RoundedRow & { episodes_total: number })[];
  listened: (RoundedRow & { episodes_listened: number })[];
  titles: { id: string; title: string }[];
  totalListenSeconds: number;
  listenByDay: ListenDay[];
}): ListenRhythm {
  const titleById = new Map(opts.titles.map((b) => [b.id, b.title]));
  const byKey = new Map<string, RhythmBookItem>();
  const key = (bookId: string, round: number) => `${bookId}:${round}`;

  for (const row of opts.episodeTotals) {
    byKey.set(key(row.book_id, row.reading_round), {
      book_id: row.book_id,
      title: titleById.get(row.book_id) ?? "Unknown book",
      reading_round: row.reading_round,
      episodes_total: row.episodes_total,
      episodes_listened: 0,
    });
  }
  for (const row of opts.listened) {
    const k = key(row.book_id, row.reading_round);
    const target = byKey.get(k);
    if (target) {
      target.episodes_listened = row.episodes_listened;
    } else {
      byKey.set(k, {
        book_id: row.book_id,
        title: titleById.get(row.book_id) ?? "Unknown book",
        reading_round: row.reading_round,
        episodes_total: 0,
        episodes_listened: row.episodes_listened,
      });
    }
  }

  const books = [...byKey.values()]
    .filter((b) => b.episodes_total > 0 || b.episodes_listened > 0)
    .sort(
      (a, b) =>
        b.episodes_listened - a.episodes_listened ||
        a.title.localeCompare(b.title),
    );

  return {
    reading_days: opts.readingDays,
    listening_days: opts.listeningDays,
    listening_episodes_total: books.reduce(
      (sum, book) => sum + book.episodes_listened,
      0,
    ),
    total_listen_seconds: opts.totalListenSeconds,
    listen_by_day: opts.listenByDay,
    books,
  };
}

export async function getListenRhythm(
  userId: string,
  opts?: { bookId?: string; round?: number },
): Promise<ListenRhythm | null> {
  // Normalize pg date values (Date objects or 'YYYY-MM-DD...' strings) to
  // 'YYYY-MM-DD' — keeps the SQL portable (pg-mem has no date::text cast).
  const toDateStr = (value: unknown): string =>
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);

  // Book-scoped requests filter listen activity to one book (and, when known,
  // one reading round) so the Book Detail heatmap matches the logs it shows.
  // The round defaults to the book's current round when not supplied.
  let round: number | null = opts?.round ?? null;
  if (opts?.bookId) {
    if (round == null) {
      const bookRow = await query<{ current_reading_round: number }>(
        "SELECT current_reading_round FROM books WHERE id=$1 AND owner_id=$2",
        [opts.bookId, userId],
      );
      if (bookRow.rows.length === 0) return null;
      round = bookRow.rows[0].current_reading_round;
    }
    const scoped = (sql: string) =>
      sql
        .replace(
          "WHERE p.user_id = $1",
          "WHERE p.user_id = $1 AND p.book_id = $2 AND p.reading_round = $3",
        )
        .replace(
          "WHERE user_id = $1",
          "WHERE user_id = $1 AND book_id = $2 AND reading_round = $3",
        );
    const params = [userId, opts.bookId, round];
    const [listening, totals, episodes, listened, listenByDay] =
      await Promise.all([
        query<{ listening_days: unknown }>(
          scoped(
            `SELECT DISTINCT listened_on AS listening_days
               FROM podcast_listen_events
              WHERE user_id = $1 ORDER BY listened_on`,
          ),
          params,
        ),
        query<{ total: number }>(
          scoped(
            `SELECT COALESCE(SUM(seconds_heard), 0) AS total
               FROM podcast_listen_events WHERE user_id = $1`,
          ),
          params,
        ),
        query<{ book_id: string; reading_round: number; episodes_total: number }>(
          scoped(
            `SELECT p.book_id, p.reading_round, COUNT(*)::int AS episodes_total
               FROM podcasts p
              WHERE p.user_id = $1 AND p.status IN ('ready','archive_pending')
              GROUP BY p.book_id, p.reading_round`,
          ),
          params,
        ),
        query<{
          book_id: string;
          reading_round: number;
          episodes_listened: number;
        }>(
          scoped(
            `SELECT book_id, reading_round, COUNT(DISTINCT podcast_id)::int AS episodes_listened
               FROM podcast_listen_events WHERE user_id = $1
              GROUP BY book_id, reading_round`,
          ),
          params,
        ),
        query<{ day: unknown; episodes: number; seconds: number }>(
          scoped(
            `SELECT listened_on AS day, COUNT(DISTINCT podcast_id)::int AS episodes, SUM(seconds_heard) AS seconds
               FROM podcast_listen_events WHERE user_id = $1
              GROUP BY listened_on ORDER BY listened_on`,
          ),
          params,
        ),
      ]);
    const reading = await query<{ reading_days: unknown }>(
      `SELECT DISTINCT l.date AS reading_days
         FROM reading_log l JOIN books b ON b.id = l.book_id
        WHERE b.owner_id = $1 ORDER BY l.date`,
      [userId],
    );
    return buildListenRhythm({
      readingDays: reading.rows.map((row) => toDateStr(row.reading_days)),
      listeningDays: listening.rows.map((row) => toDateStr(row.listening_days)),
      episodeTotals: episodes.rows.map((row) => ({
        book_id: row.book_id,
        reading_round: row.reading_round,
        episodes_total: Number(row.episodes_total),
      })),
      listened: listened.rows.map((row) => ({
        book_id: row.book_id,
        reading_round: row.reading_round,
        episodes_listened: Number(row.episodes_listened),
      })),
      titles: [{ id: opts.bookId, title: "" }],
      totalListenSeconds: Number(totals.rows[0]?.total || 0),
      listenByDay: listenByDay.rows.map((row) => ({
        day: toDateStr(row.day),
        episodes: Number(row.episodes),
        seconds: Math.round(Number(row.seconds) || 0),
      })),
    });
  }

  const [reading, listening, totals, episodes, listened, titles, listenByDay] =
    await Promise.all([
      query<{ reading_days: unknown }>(
        `SELECT DISTINCT l.date AS reading_days
           FROM reading_log l JOIN books b ON b.id = l.book_id
          WHERE b.owner_id = $1 ORDER BY l.date`,
        [userId],
      ),
      query<{ listening_days: unknown }>(
        `SELECT DISTINCT listened_on AS listening_days
           FROM podcast_listen_events
          WHERE user_id = $1 ORDER BY listened_on`,
        [userId],
      ),
      query<{ total: number }>(
        `SELECT COALESCE(SUM(seconds_heard), 0) AS total
           FROM podcast_listen_events WHERE user_id = $1`,
        [userId],
      ),
      query<{ book_id: string; reading_round: number; episodes_total: number }>(
        `SELECT p.book_id, p.reading_round, COUNT(*)::int AS episodes_total
           FROM podcasts p
          WHERE p.user_id = $1 AND p.status IN ('ready','archive_pending')
          GROUP BY p.book_id, p.reading_round`,
        [userId],
      ),
      query<{
        book_id: string;
        reading_round: number;
        episodes_listened: number;
      }>(
        `SELECT book_id, reading_round, COUNT(DISTINCT podcast_id)::int AS episodes_listened
           FROM podcast_listen_events WHERE user_id = $1
          GROUP BY book_id, reading_round`,
        [userId],
      ),
      query<{ id: string; title: string }>(
        `SELECT id, title FROM books WHERE owner_id = $1`,
        [userId],
      ),
      query<{ day: unknown; episodes: number; seconds: number }>(
        `SELECT listened_on AS day, COUNT(DISTINCT podcast_id)::int AS episodes, SUM(seconds_heard) AS seconds
           FROM podcast_listen_events WHERE user_id = $1
          GROUP BY listened_on ORDER BY listened_on`,
        [userId],
      ),
    ]);

  return buildListenRhythm({
    readingDays: reading.rows.map((row) => toDateStr(row.reading_days)),
    listeningDays: listening.rows.map((row) => toDateStr(row.listening_days)),
    episodeTotals: episodes.rows.map((row) => ({
      book_id: row.book_id,
      reading_round: row.reading_round,
      episodes_total: Number(row.episodes_total),
    })),
    listened: listened.rows.map((row) => ({
      book_id: row.book_id,
      reading_round: row.reading_round,
      episodes_listened: Number(row.episodes_listened),
    })),
    titles: titles.rows,
    totalListenSeconds: Number(totals.rows[0]?.total || 0),
    listenByDay: listenByDay.rows.map((row) => ({
      day: toDateStr(row.day),
      episodes: Number(row.episodes),
      seconds: Math.round(Number(row.seconds) || 0),
    })),
  });
}
