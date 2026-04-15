import postgres from "postgres";

/**
 * RLS-Aware Database Client
 * Uses a direct Postgres connection to execute transactions wrapped in SET LOCAL
 * session variables. This is the core architectural requirement for RLS enforcement.
 */

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn("DATABASE_URL is not set. withRLS wrapper will not function correctly.");
}

let sql: postgres.Sql<{}>;

if (dbUrl) {
  sql = postgres(dbUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
  });
} else {
  // Mock sql object for build time/missing env
  sql = (() => {
    const mock = () => { throw new Error("DATABASE_URL is not configured."); };
    mock.begin = () => { throw new Error("DATABASE_URL is not configured."); };
    return mock as unknown as postgres.Sql<{}>;
  })();
}

export interface RLSContext {
  org_id: string;
  user_id: string;
  user_role: string;
  department_id: string;
  accessible_dept_ids?: string[];
}

/**
 * Extracts RLS context from request headers.
 * These headers are injected by the middleware after RBAC resolution.
 */
export function getContextFromHeaders(headers: Headers): RLSContext | null {
  const org_id = headers.get("x-current-org-id");
  const user_id = headers.get("x-current-user-id");
  const user_role = headers.get("x-current-user-role");
  const department_id = headers.get("x-current-user-dept-id") || "";
  const accessible_depts_raw = headers.get("x-current-accessible-depts");

  if (!org_id || !user_id || !user_role) {
    return null;
  }

  return {
    org_id,
    user_id,
    user_role,
    department_id,
    accessible_dept_ids: accessible_depts_raw ? JSON.parse(accessible_depts_raw) : [],
  };
}

/**
 * Wraps a database operation in a transaction that sets the session context.
 */
export async function withRLS<T>(
  context: RLSContext,
  callback: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  return await sql.begin(async (tx) => {
    // 1. Set standard session variables
    await tx`SET LOCAL app.org_id = ${context.org_id}`;
    await tx`SET LOCAL app.user_id = ${context.user_id}`;
    await tx`SET LOCAL app.user_role = ${context.user_role}`;
    await tx`SET LOCAL app.department_id = ${context.department_id}`;

    // 2. Handle Super User (bi_analyst) session grants
    // Migration 002 uses a temp table 'session_grants' for complex access rules
    if (context.user_role === "super_user" && context.accessible_dept_ids?.length) {
      await tx`CREATE TEMP TABLE IF NOT EXISTS session_grants (
        scope_type text,
        scope_id text
      ) ON COMMIT DROP`;
      
      // Populate temp table with department grants
      for (const deptId of context.accessible_dept_ids) {
        await tx`INSERT INTO session_grants (scope_type, scope_id) VALUES ('department', ${deptId})`;
      }
    }

    // 3. Execute the actual work
    return await callback(tx);
  });
}
