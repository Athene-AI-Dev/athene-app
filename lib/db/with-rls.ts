import { pool } from "./pool";

type Role = "member" | "admin" | "bi_analyst";

export async function withRLS<T>(
  orgId: string,
  userId: string,
  role: Role,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔐 Inject RLS context
    await client.query(`SET LOCAL app.org_id = $1`, [orgId]);
    await client.query(`SET LOCAL app.user_id = $1`, [userId]);
    await client.query(`SET LOCAL app.user_role = $1`, [role]);

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
