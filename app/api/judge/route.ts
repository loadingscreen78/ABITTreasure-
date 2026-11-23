import { z } from "zod";
import { TIE_BREAKERS } from "@/lib/content/schema";
import { audit, safe } from "@/lib/server/db";
import { fail, handler, json, readJson } from "@/lib/server/http";
import { actorOf, organiserRequest } from "@/lib/server/organiser-route";
import { loadSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";

export const GET = handler("judge/get", async () => {
  const r = await organiserRequest(["admin", "judge"]);
  if (!r.ok) return r.res;
  const snap = await loadSnapshot(r.db);
  if (!snap) return fail("NETWORK", "Database unreachable. Retrying…", 503);
  const byId = new Map(snap.standings.map((s) => [s.id, s]));
  const teams = snap.teams
    .filter((t) => !t.is_rehearsal)
    .map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      cleared: t.cleared,
      unlockedCp: t.unlocked_cp,
      arrived: t.arrived,
      finishedAt: t.finished_at,
      elapsedMs: t.elapsedMs,
      judgeCode: t.judge_code,
      teamwork: t.teamwork,
      finalConfirmed: t.final_confirmed,
      finalRevoked: t.final_revoked,
      standing: byId.get(t.id) ?? null,
    }));
  return json({ ok: true, now: snap.now, event: { status: snap.event.status, startedAt: snap.event.started_at, resultsRevealed: snap.event.results_revealed }, teams, tieBreakers: TIE_BREAKERS, me: { role: r.org.role, email: r.org.email } });
});

const Body = z.object({
  teamId: z.string().regex(/^T\d{2,3}$/),
  teamwork: z.number().int().min(0).max(5).nullable().optional(),
  final: z.enum(["confirm", "revoke"]).optional(),
});

export const POST = handler("judge/post", async (req: Request) => {
  const r = await organiserRequest(["admin", "judge"]);
  if (!r.ok) return r.res;
  const p = Body.safeParse(await readJson(req));
  if (!p.success) return fail("BAD_INPUT", "Invalid request.", 400);
  const patch: Record<string, unknown> = {};
  if (p.data.teamwork !== undefined) patch.teamwork = p.data.teamwork;
  if (p.data.final === "confirm") Object.assign(patch, { final_confirmed: true, final_revoked: false });
  if (p.data.final === "revoke") Object.assign(patch, { final_confirmed: false, final_revoked: true });
  if (!Object.keys(patch).length) return fail("BAD_INPUT", "Nothing to change.", 400);
  const u = await safe(r.db.from("teams").update(patch).eq("id", p.data.teamId).select("id"), "judge update");
  if (u.error) return fail("FAILED", "Could not save.", 500);
  await audit(r.db, actorOf(r.org), "judge", { teamId: p.data.teamId, ...patch });
  return json({ ok: true });
});
