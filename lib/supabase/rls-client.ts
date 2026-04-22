import { Pool } from "pg";

/**
 * Consolidated Database Connection Pool.
 * Used for raw SQL queries that require pgvector or complex joins not supported by Supabase JS.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const globalForPg = global as unknown as { pool: Pool };

export const pool =
  globalForPg.pool ||
  new Pool({
    connectionString,
    max: 10, // Optimized connection count
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pool = pool;

type Role = "member" | "admin" | "bi_analyst";

/**
 * Executes a callback within a transaction where RLS session variables are set.
 * This pattern ensures that raw pg queries respect Supabase RLS policies.
 */
export async function withRLS<T>(
  orgId: string,
  userId: string,
  role: Role,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔐 Inject RLS context into the session
    // These variables should match the ones expected by RLS policies in migrations.
    await client.query(`SET LOCAL app.org_id = $1`, [orgId]);
    await client.query(`SET LOCAL app.user_id = $2`, [userId]);
    await client.query(`SET LOCAL app.user_role = $3`, [role]);

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
