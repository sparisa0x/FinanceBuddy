import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.https://ntrwqhqlpfzwqaoflywy.supabase.co;
const supabaseAnonKey = import.meta.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50cndxaHFscGZ6d3Fhb2ZseXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjE1ODcsImV4cCI6MjA4ODEzNzU4N30._p-J_Vxqym-GBXgQpqLmDwYoy7Y4NZ9t-S5g2vmPyas;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. Configure these in Vercel Project Settings → Environment Variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid-project.supabase.co',
  supabaseAnonKey || 'invalid-anon-key'
);
