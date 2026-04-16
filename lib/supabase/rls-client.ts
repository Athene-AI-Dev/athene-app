import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type RLSContext = {
  org_id: string
  user_id: string
  department_id?: string
  user_role?: 'member' | 'super_user' | 'admin'
  accessible_dept_ids?: string[]
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
    user_role: user_role as 'member' | 'super_user' | 'admin',
    department_id,
    accessible_dept_ids: accessible_depts_raw ? JSON.parse(accessible_depts_raw) : [],
  };
}

export const getRLSClient = (context: RLSContext, grants?: any[]) => {
  let headers: Record<string, string> = {
    'x-app-org-id': context.org_id,
    'x-app-user-id': context.user_id,
    'x-app-dept-id': context.department_id || '',
    'x-app-role': context.user_role || 'member'
  }
  
  if (grants && grants.length > 0) {
    headers['x-app-grants'] = JSON.stringify(grants)
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: { headers }
  })
}

/**
 * helper to execute a callback with the RLS context set in the database session.
 */
export async function withRLS<T>(
  context: RLSContext, 
  callback: (supabase: ReturnType<typeof getRLSClient>) => Promise<T>
): Promise<T> {
  let grants: any[] = []

  // If super_user, map the accessible departments from the Clerk middleware cache.
  // Fallback to fetching directly if not provided via middleware headers.
  if (context.user_role === 'super_user') {
    if (context.accessible_dept_ids && context.accessible_dept_ids.length > 0) {
      grants = context.accessible_dept_ids.map(deptId => ({
        scope_type: 'department',
        scope_id: deptId
      }));
    } else {
      const tempClient = getRLSClient({ ...context, user_role: 'member' }) 
      const { data } = await tempClient
        .from('access_grants')
        .select('scope_type, scope_id')
        .eq('user_id', context.user_id)
        .eq('org_id', context.org_id)
        
      if (data) {
        grants = data
      }
    }
  }

  // Create the final client populated with headers and grants
  const supabase = getRLSClient(context, grants)

  return callback(supabase)
}
