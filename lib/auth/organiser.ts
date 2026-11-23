import "server-only";
import type { Env } from "@/lib/env";
import { serverClient } from "@/lib/supabase/server";

export type OrganiserRole = "admin" | "judge";
export interface Organiser {
  id: string;
  email: string | null;
  role: OrganiserRole;
}

/**
 * Verifies the organiser on EVERY admin/judge request with supabase.auth.getClaims()
 * (JWKS-verified JWT) and reads app_metadata.role. Never trusts getSession() on the server.
 */
export async function getOrganiser(env: Env): Promise<Organiser | null> {
  try {
    const supabase = await serverClient(env);
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    const claims = data.claims as { sub?: string; email?: string; app_metadata?: { role?: unknown } };
    const role = claims.app_metadata?.role;
    if (role !== "admin" && role !== "judge") return null;
    return { id: String(claims.sub ?? ""), email: claims.email ?? null, role };
  } catch {
    return null;
  }
}

export function allows(o: Organiser | null, roles: OrganiserRole[]): o is Organiser {
  return !!o && roles.includes(o.role);
}
