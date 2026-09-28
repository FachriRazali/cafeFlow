import { Pool, types, type PoolClient } from "pg";

// node-postgres returns BIGINT (OID 20) columns as strings by default, since
// bigint can exceed JS's safe integer range. Every id/FK column in this
// schema is a plain identity sequence well inside Number.MAX_SAFE_INTEGER,
// and the whole app (route handlers, React state, `===` comparisons on
// table/reservation ids) assumes real numbers — so parse them as numbers
// globally instead of hunting down every call site.
types.setTypeParser(20, (val: string) => parseInt(val, 10));

// Singleton connection pool. Reused across requests/hot-reloads in dev via a
// global cache (Next.js re-evaluates modules per compiled route in some
// environments, but a single Node process should still share one pool).
declare global {
  // eslint-disable-next-line no-var
  var __cafeflowPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy web/.env.example to web/.env.local and paste your Postgres " +
        "connection string (e.g. from Neon's dashboard) into it."
    );
  }
  return new Pool({
    connectionString,
    // Neon (and most managed Postgres) require TLS; a plain local Postgres
    // for development does not use it at all, so only enable it for
    // non-local hosts.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: true },
    max: 5
  });
}

export const pool = globalThis.__cafeflowPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__cafeflowPool = pool;

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
