import { createClient } from "@supabase/supabase-js";

// Server-only client using the service_role key, which bypasses row-level
// security. Correct for this app: every Supabase call happens in API
// routes and Server Components, never in the browser, so there's no
// client-side key to keep separate.
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/** Throws with a readable message if a Supabase call's `error` is set -
 * call sites do `unwrap(await db.from(...)...)` instead of checking
 * `{ data, error }` by hand everywhere. */
export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}
