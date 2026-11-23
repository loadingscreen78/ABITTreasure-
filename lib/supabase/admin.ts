import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "@/lib/env";

/** Secret-key client. Bypasses RLS. SERVER ONLY — every game read/write goes through this. */
let cached: { key: string; client: SupabaseClient } | null = null;

export function adminClient(env: Env): SupabaseClient {
  const key = env.NEXT_PUBLIC_SUPABASE_URL + env.SUPABASE_SECRET_KEY.slice(-6);
  if (cached?.key === key) return cached.client;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-client-info": "abit-hunt-server" } },
  });
  cached = { key, client };
  return client;
}
