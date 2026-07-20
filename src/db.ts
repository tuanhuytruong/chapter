import { Pool } from "pg";

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

export async function ensureSchema(): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  await getPool().query(sql);
  console.log("[db] schema ensured");
}
