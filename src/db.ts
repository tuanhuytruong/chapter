import { Pool } from "pg";

// Keep Postgres DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date
// objects. The default JS Date parsing shifts to UTC and, once JSON-serialized
// by Express, produces an ISO string with a time suffix that breaks client-side
// `new Date(...)` parsing ("Invalid Date"). Returning the raw string avoids that.
// Use the pg module imported above (dynamic require() is unsupported in the ESM build).
const pgTypes = (Pool as any).types;
if (pgTypes && typeof pgTypes.setTypeParser === "function") {
  pgTypes.setTypeParser(1082, (val: string) => val); // 1082 = DATE oid
}

/**
 * PostgreSQL connection for the Chapter app.
 *
 * Production: a real `pg.Pool` backed by DATABASE_URL (Postgres on e7240ubt).
 * Tests: an injected pool (e.g. pg-mem) can be supplied via setPool() so the
 * exact same query code is exercised without a running server.
 */
let pool: Pool;

function createDefaultPool(): Pool {
  const connectionString = process.env.DATABASE_URL ?? "";
  // Schema option A: all queries target the `chapter` schema.
  const base = connectionString
    ? { connectionString, max: 10, idleTimeoutMillis: 30000 }
    : { host: "localhost", port: 5432, database: "chapter", user: "postgres", password: "", max: 1 };
  return new Pool({ ...base, options: "-c search_path=chapter" });
}

export function getPool(): Pool {
  if (!pool) pool = createDefaultPool();
  return pool;
}

/** Inject a pool (used by integration tests with pg-mem). */
export function setPool(p: Pool): void {
  pool = p;
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const p = getPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount };
  } catch (err: any) {
    console.error(`[db] query failed (${Date.now() - start}ms):`, err.message);
    throw err;
  }
}

export async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Run related writes atomically; a failed review-card seed rolls back its log too. */
export async function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  });
}

export async function ensureSchema(): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");

  // Split into individual statements so one failing statement (e.g. CREATE
  // SCHEMA denied because the app role lacks privileges) does not abort the
  // rest. The `chapter` schema is expected to be created once by an admin
  // role; the app role only needs CREATE TABLE inside it.
  //
  // Strip SQL comments first (-- line comments and /* */ blocks) so commented
  // text is not sent to the driver as a statement (which would also break on
  // smart-quote characters inside comments).
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/--[^\r\n]*/g, " "); // line comments (also strip \r for CRLF files)
  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const pool = getPool();
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err: any) {
      // Ignore "CREATE SCHEMA" permission errors — schema already exists or
      // was created by an admin. Any other error is fatal.
      const isSchemaPermErr =
        /create schema/i.test(stmt) &&
        /permission denied/i.test(err.message);
      if (isSchemaPermErr) {
        console.warn(
          "[db] skipping CREATE SCHEMA (permission denied) — assuming schema 'chapter' already exists"
        );
        continue;
      }
      console.error("[db] schema statement failed:", err.message);
      console.error("[db] statement:", stmt.slice(0, 80));
      throw err;
    }
  }
  console.log("[db] schema ensured");
}
