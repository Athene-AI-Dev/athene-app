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
          return () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
                  }),
                  single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null })
                  })
                })
              }),
              limit: () => ({
                eq: () => Promise.resolve({ data: [], error: null })
              })
            })
          });
        }
        return undefined;
      }
    });

export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);
