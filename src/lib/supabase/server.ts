import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the anon key.
 * Used in Server Components and API routes for read-only queries.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(url, key);
}

/** Supabase itself is down (network failure or 5xx), as opposed to a query-level miss. */
export class SupabaseUnavailableError extends Error {
  name = 'SupabaseUnavailableError';
}

/**
 * Await a query, throwing on an outage so a cached (ISR) page fails its
 * re-render and the last good copy keeps serving (or the build fails, rather
 * than prerendering an empty page). 4xx errors (absent table or RPC) pass
 * through to each loader's own fallback.
 */
export async function failOnOutage<
  R extends { error: { message: string } | null; status: number },
>(query: PromiseLike<R>, what: string): Promise<R> {
  const res = await query;
  if (res.error && (res.status === 0 || res.status >= 500)) {
    throw new SupabaseUnavailableError(`${what}: HTTP ${res.status} ${res.error.message}`);
  }
  return res;
}
