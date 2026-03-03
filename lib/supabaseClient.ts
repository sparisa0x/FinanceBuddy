import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. Configure these in Vercel Project Settings → Environment Variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid-project.supabase.co',
  supabaseAnonKey || 'invalid-anon-key'
);
