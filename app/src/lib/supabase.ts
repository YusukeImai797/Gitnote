import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For server-side operations that need elevated permissions
export function getServiceSupabase() {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    console.error('[Supabase] Missing SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('[Supabase] Initializing service client with key length:', supabaseServiceKey.length);
  return createClient(supabaseUrl, supabaseServiceKey);
}
