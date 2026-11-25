import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { sealText } from "@/lib/auth/secretbox";
import { formatPassword, newPassword, teamIdFor } from "@/lib/game/ids";
import { safe } from "./db";

export async function nextTeamNumber(db: SupabaseClient): Promise<number> {
  const r = await safe(db.from("teams").select("id"), "team ids");
  const ids = ((r.data as { id: string }[] | null) ?? []).map((x) => Number(x.id.slice(1))).filter((n) => Number.isFinite(n));
  return Math.max(0, ...ids) + 1;
}

/** Creates one team with a fresh password. Returns the password ONCE (also sealed for slip reprints). */
export async function createTeam(db: SupabaseClient, env: Env, input: { id?: string; password?: string; name: string; members: string[]; rehearsal?: boolean }) {
  const id = input.id ?? teamIdFor(await nextTeamNumber(db));
  const pw = input.password ?? newPassword();
  const row = {
    id,
    name: input.name.slice(0, 60),
    members: input.members.slice(0, 4).map((m) => m.slice(0, 60)),
    password_hash: await hashPassword(pw, env.BCRYPT_COST ?? 5),
    password_enc: await sealText(pw, env.SESSION_SECRET),
    is_rehearsal: input.rehearsal ?? false,
  };
  const r = await safe(db.from("teams").insert(row).select("id").single(), "create team");
  if (r.error) return { ok: false as const, error: r.error };
  return { ok: true as const, id, password: formatPassword(pw) };
}

/** New password + bump session_version → every logged-in phone of that team is signed out. */
export async function resetPassword(db: SupabaseClient, env: Env, id: string) {
  const pw = newPassword();
  const cur = await safe(db.from("teams").select("session_version").eq("id", id).single(), "sv");
  if (cur.error || !cur.data) return { ok: false as const, error: cur.error ?? "not found" };
  const sv = (cur.data as { session_version: number }).session_version + 1;
  const r = await safe(
    db
      .from("teams")
      .update({ password_hash: await hashPassword(pw, env.BCRYPT_COST ?? 5), password_enc: await sealText(pw, env.SESSION_SECRET), session_version: sv })
      .eq("id", id)
      .select("id")
      .single(),
    "reset password",
  );
  if (r.error) return { ok: false as const, error: r.error };
  return { ok: true as const, id, password: formatPassword(pw) };
}
