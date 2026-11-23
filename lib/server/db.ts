import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DbResult<T> = { data: T; error: null } | { data: null; error: string };

/** Tiny wrapper: every Supabase call returns { data, error } and never throws. */
export async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<DbResult<T>> {
  try {
    const { data, error } = await db.rpc(fn, args);
    if (error) {
      console.error(`[db] rpc ${fn}:`, error.code ?? "", error.message);
      return { data: null, error: error.message };
    }
    return { data: data as T, error: null };
  } catch (e) {
    console.error(`[db] rpc ${fn} threw:`, e instanceof Error ? e.message : "unknown");
    return { data: null, error: "network" };
  }
}

export async function safe<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, label: string): Promise<DbResult<T>> {
  try {
    const { data, error } = await p;
    if (error) {
      console.error(`[db] ${label}:`, error.message);
      return { data: null, error: error.message };
    }
    return { data: data as T, error: null };
  } catch (e) {
    console.error(`[db] ${label} threw:`, e instanceof Error ? e.message : "unknown");
    return { data: null, error: "network" };
  }
}

export async function audit(db: SupabaseClient, actor: string, action: string, detail: Record<string, unknown> = {}) {
  await safe(db.from("audit_logs").insert({ actor, action, detail }), "audit");
}
