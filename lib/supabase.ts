import { createClient } from '@supabase/supabase-js';

// VITE_ env vars are baked into the bundle at build time.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ntrwqhqlpfzwqaoflywy.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bZ7J9NURAlzQqSPtQUU84A_EVfXwHBm';

/** Basic anon client — used for unauthenticated operations (e.g., registration insert). */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Create a Supabase client that uses a Clerk-issued JWT for every request.
 * This client should be used for all authenticated operations so that
 * Row-Level Security policies can verify the caller via `public.clerk_uid()`.
 *
 * Usage: call inside a React component that has access to Clerk's `getToken`.
 *
 * ```ts
 * const { getToken } = useAuth();
 * const client = createClerkSupabaseClient(getToken);
 * ```
 */
export function createClerkSupabaseClient(
  getToken: (opts?: { template?: string }) => Promise<string | null>,
) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        let clerkToken: string | null = null;
        try {
          // Prefer the dedicated Supabase JWT template. Some deployments are
          // configured against Clerk's Supabase template rather than the raw
          // session token, so falling back avoids breaking either setup.
          clerkToken = await getToken({ template: 'supabase' });
          if (!clerkToken) {
            clerkToken = await getToken();
          }
        } catch (err) {
          console.error('[Supabase] Failed to get Clerk JWT:', err);
        }
        const headers = new Headers((options as RequestInit).headers);
        if (clerkToken) {
          headers.set('Authorization', `Bearer ${clerkToken}`);
        } else {
          console.warn('[Supabase] No Clerk JWT — requests will be unauthenticated.');
        }
        return fetch(url, { ...options, headers });
      },
    },
  });
}
