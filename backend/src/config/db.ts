import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabase) return supabase;
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  return supabase;
}

export async function connectToDatabase() {
  const client = getSupabase();
  // Verify connectivity
  const { error } = await client.from('users').select('id').limit(1);
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  console.log('✅ Supabase connected');
  return client;
}
