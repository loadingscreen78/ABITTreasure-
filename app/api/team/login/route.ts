import { cookies } from "next/headers";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { checkPassword } from "@/lib/auth/password";
import { cookieOptions, signTeamSession, TEAM_COOKIE } from "@/lib/auth/session";
import { canonicalPassword, canonicalTeamId } from "@/lib/game/ids";
import { rpc, safe } from "@/lib/server/db";
import { clientIp, fail, handler, isSecure, json, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const Body = z.object({ teamId: z.string().max(12), password: z.string().max(20), token: z.string().max(16).optional() });
const NO_MATCH = "That Team ID and password don't match. Check your slip or ask a volunteer.";

export const POST = handler("team/login", async (req: Request) => {
  const e = readEnv();
  if (!e.ok) return fail("SETUP", "Event system is warming up, please ask a volunteer.", 503);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("BAD_INPUT", NO_MATCH, 400);
  const teamId = canonicalTeamId(parsed.data.teamId);
  const password = canonicalPassword(parsed.data.password);
  if (!teamId || password.length < 4) return fail("NO_MATCH", NO_MATCH, 401);

  const db = adminClient(e.env);
  const allowed = await rpc<boolean>(db, "throttle_hit", {
    p_key: `login:${clientIp(req)}:${teamId}`,
    p_limit: 5,
    p_window_seconds: 60,
  });
  if (allowed.error) return fail("NETWORK", "Weak signal — retrying…", 503);
  if (!allowed.data) return fail("THROTTLED", "Too many tries. Wait a minute, then try again — or ask a volunteer.", 429);

  const r = await safe(db.from("teams").select("id, password_hash, session_version").eq("id", teamId).maybeSingle(), "login team");
  if (r.error) return fail("NETWORK", "Weak signal — retrying…", 503);
  const team = r.data as { id: string; password_hash: string; session_version: number } | null;
  if (!team || !(await checkPassword(password, team.password_hash))) return fail("NO_MATCH", NO_MATCH, 401);

  const jwt = await signTeamSession({ teamId: team.id, sv: team.session_version, st: parsed.data.token }, e.env.SESSION_SECRET);
  (await cookies()).set(TEAM_COOKIE, jwt, cookieOptions(isSecure(req)));
  return json({ ok: true, teamId: team.id });
});
