import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readEnv, type Env } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { TEAM_COOKIE, verifyTeamSession, type TeamSession } from "@/lib/auth/session";
import { loadCtx, type TeamCtx } from "./team";

export type TeamReq =
  | { kind: "setup"; missing: string[] }
  | { kind: "anon"; env: Env; db: SupabaseClient; reason?: "expired" }
  | { kind: "error"; env: Env; db: SupabaseClient }
  | { kind: "team"; env: Env; db: SupabaseClient; session: TeamSession; ctx: TeamCtx };

/** env → session cookie → team_context (one DB round-trip) → session-version check. */
export async function teamRequest(): Promise<TeamReq> {
  const e = readEnv();
  if (!e.ok) return { kind: "setup", missing: e.missing };
  const env = e.env;
  const db = adminClient(env);
  const jar = await cookies();
  const session = await verifyTeamSession(jar.get(TEAM_COOKIE)?.value, env.SESSION_SECRET);
  if (!session) return { kind: "anon", env, db };
  const r = await loadCtx(db, session.teamId);
  if (r.error) return { kind: "error", env, db };
  if (!r.data || r.data.sessionVersion !== session.sv) {
    jar.delete(TEAM_COOKIE);
    return { kind: "anon", env, db, reason: "expired" };
  }
  return { kind: "team", env, db, session, ctx: r.data };
}
