import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// 🛡️ Create client only if credentials are provided
// This prevents the application from crashing in local dev without Supabase keys
export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : new Proxy({} as any, {
      get(_, prop) {
        if (prop === 'from') {
          const mockSingle = () => Promise.resolve({ data: null, error: null });
          const mockMany = () => Promise.resolve({ data: [], error: null });
          const chain = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: mockSingle,
            single: mockSingle,
            limit: () => chain,
            order: () => chain,
            upsert: mockSingle,
            delete: () => chain,
          };
          return () => chain;
        }
        return undefined;
      }
    });

export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);
