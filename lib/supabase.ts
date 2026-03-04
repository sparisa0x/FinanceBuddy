import { createClient } from '@supabase/supabase-js';

// VITE_ env vars are baked into the bundle at build time.
// The anon key is a public client-side credential — security is enforced
// by Supabase Row-Level Security policies, not by hiding this key.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ntrwqhqlpfzwqaoflywy.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bZ7J9NURAlzQqSPtQUU84A_EVfXwHBm';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
