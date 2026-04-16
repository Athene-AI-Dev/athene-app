import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type RLSContext = {
  org_id: string
  user_id: string
  department_id?: string
  user_role?: 'member' | 'super_user' | 'admin'
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

  if (!org_id || !user_id || !user_role) {
    return null;
  }

  return {
    org_id,
    user_id,
    user_role: user_role as 'member' | 'super_user' | 'admin',
    department_id,
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

  // If super_user, fetch grants using an initially scoped client
  if (context.user_role === 'super_user') {
    const tempClient = getRLSClient({ ...context, user_role: 'member' }) // Fetch as basic member to test RLS safely on grants table
    const { data } = await tempClient
      .from('access_grants')
      .select('scope_type, scope_id')
      .eq('user_id', context.user_id)
      .eq('org_id', context.org_id)
      
    if (data) {
      grants = data
    }
  }

  // Create the final client populated with headers and grants
  const supabase = getRLSClient(context, grants)

  return callback(supabase)
}
