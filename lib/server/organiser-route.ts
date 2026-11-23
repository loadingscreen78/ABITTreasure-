import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readEnv, type Env } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { allows, getOrganiser, type Organiser, type OrganiserRole } from "@/lib/auth/organiser";
import { fail } from "./http";

export type OrgReq = { ok: true; env: Env; db: SupabaseClient; org: Organiser } | { ok: false; res: Response };

/** env → getClaims() → role check. Run on every admin / judge request. */
export async function organiserRequest(roles: OrganiserRole[]): Promise<OrgReq> {
  const e = readEnv();
  if (!e.ok) return { ok: false, res: fail("SETUP", `Setup incomplete — missing ${e.missing.join(", ")}`, 503, { missing: e.missing }) };
  const org = await getOrganiser(e.env);
  if (!org) return { ok: false, res: fail("AUTH", "Please sign in with an organiser account.", 401) };
  if (!allows(org, roles)) return { ok: false, res: fail("FORBIDDEN", `This needs the ${roles.join(" or ")} role.`, 403) };
  return { ok: true, env: e.env, db: adminClient(e.env), org };
}

export const actorOf = (o: Organiser) => `${o.role}:${o.email ?? o.id}`;
