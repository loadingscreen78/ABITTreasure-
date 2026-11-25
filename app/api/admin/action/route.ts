import { z } from "zod";
import { canonicalPassword, canonicalTeamId, newToken, REHEARSAL_TEAM_ID } from "@/lib/game/ids";
import { withDefaults } from "@/lib/game/scoring";
import { audit, rpc, safe } from "@/lib/server/db";
import { fail, handler, json, readJson } from "@/lib/server/http";
import { actorOf, organiserRequest } from "@/lib/server/organiser-route";
import { createTeam, resetPassword } from "@/lib/server/teams-admin";
import { loadCtx, scan } from "@/lib/server/team";

export const dynamic = "force-dynamic";

const Id = z.string().regex(/^T\d{2,3}$/);
const SettingsPatch = z
  .object({
    secretWord: z.string().trim().min(2).max(40),
    marksPerClue: z.number().int().min(0).max(10),
    fullMarksWithinAttempts: z.number().int().min(1).max(10),
    cooldownSecondsAfterLimit: z.number().int().min(0).max(300),
    timeBonusMode: z.enum(["tiered", "tiebreak"]),
    hintPenalty: z.number().int().min(0).max(5),
    loginEveryScan: z.boolean(),
    showScoresOnBoard: z.boolean(),
    timeLimitMinutes: z.number().int().min(0).max(240),
    registrationOpen: z.boolean(),
  })
  .partial();

const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), action: z.enum(["START", "PAUSE", "RESUME", "END", "REVEAL", "HIDE"]), delaySeconds: z.number().int().min(0).max(3600).optional() }),
  z.object({ type: z.literal("settings"), patch: SettingsPatch }),
  z.object({ type: z.literal("checkpoint"), code: z.string().regex(/^CP-\d{2}$/), venueDetail: z.string().max(200).optional(), location: z.string().max(120).optional() }),
  z.object({ type: z.literal("rotate_token"), code: z.string().regex(/^CP-\d{2}$/) }),
  z.object({
    type: z.literal("team_create"),
    name: z.string().trim().min(1).max(60),
    members: z.array(z.string().max(60)).max(4),
    id: z.string().trim().max(8).optional(),
    password: z.string().trim().max(20).optional().or(z.literal("")),
  }),
  z.object({ type: z.literal("team_update"), id: Id, name: z.string().trim().min(1).max(60), members: z.array(z.string().max(60)).max(4) }),
  z.object({ type: z.literal("team_delete"), id: Id }),
  z.object({ type: z.literal("team_reset_password"), id: Id }),
  z.object({ type: z.literal("team_reset_progress"), id: Id }),
  z.object({ type: z.literal("team_disqualify"), id: Id, reason: z.string().trim().min(3).max(200) }),
  z.object({ type: z.literal("team_reinstate"), id: Id }),
  z.object({ type: z.literal("team_adjust"), id: Id, marks: z.number().int().min(-100).max(100), reason: z.string().trim().min(3).max(200) }),
  z.object({ type: z.literal("rehearsal_simulate"), code: z.string().regex(/^CP-\d{2}$/) }),
  z.object({ type: z.literal("rehearsal_create") }),
  z.object({ type: z.literal("rehearsal_reset") }),
  z.object({ type: z.literal("reset_all"), confirm: z.literal("RESET") }),
  z.object({ type: z.literal("reg_import"), id: z.number().int().positive() }),
  z.object({ type: z.literal("reg_reject"), id: z.number().int().positive() }),
  z.object({ type: z.literal("reg_restore"), id: z.number().int().positive() }),
]);

export const POST = handler("admin/action", async (req: Request) => {
  const r = await organiserRequest(["admin"]);
  if (!r.ok) return r.res;
  const parsed = Action.safeParse(await readJson(req));
  if (!parsed.success) return fail("BAD_INPUT", parsed.error.issues[0]?.message ?? "Invalid request", 400);
  const a = parsed.data;
  const { db, env } = r;
  const actor = actorOf(r.org);
  const done = async (detail: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
    await audit(db, actor, a.type, { ...a, ...detail });
    return json({ ok: true, ...extra });
  };
  const err = (m: string) => fail("FAILED", m, 500);

  switch (a.type) {
    case "event": {
      const ev = await safe(db.from("event_state").select("settings").eq("id", 1).single(), "event");
      if (ev.error) return err("Could not read event state.");
      const s = withDefaults((ev.data as unknown as { settings: Record<string, unknown> }).settings);
      const now = Date.now();
      let patch: Record<string, unknown> = {};
      if (a.action === "START") {
        const start = new Date(now + (a.delaySeconds ?? 3) * 1000);
        patch = {
          status: "LIVE",
          started_at: start.toISOString(),
          ends_at: s.timeLimitMinutes > 0 ? new Date(start.getTime() + s.timeLimitMinutes * 60_000).toISOString() : null,
          results_revealed: false,
        };
      } else if (a.action === "PAUSE") patch = { status: "PAUSED" };
      else if (a.action === "RESUME") patch = { status: "LIVE" };
      else if (a.action === "END") patch = { status: "ENDED", ends_at: new Date(now).toISOString() };
      else if (a.action === "REVEAL") patch = { results_revealed: true };
      else if (a.action === "HIDE") patch = { results_revealed: false };
      const u = await safe(db.from("event_state").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1).select("id"), "event update");
      return u.error ? err("Could not update the event.") : done(patch);
    }
    case "settings": {
      const ev = await safe(db.from("event_state").select("settings").eq("id", 1).single(), "settings read");
      if (ev.error) return err("Could not read settings.");
      const merged = { ...(ev.data as unknown as { settings: Record<string, unknown> }).settings, ...a.patch };
      const u = await safe(db.from("event_state").update({ settings: merged, updated_at: new Date().toISOString() }).eq("id", 1).select("id"), "settings");
      // never write the secret word itself into the audit log
      return u.error ? err("Could not save settings.") : done({ patch: { ...a.patch, ...(a.patch.secretWord ? { secretWord: "(changed)" } : {}) } });
    }
    case "checkpoint": {
      const patch: Record<string, unknown> = {};
      if (a.venueDetail !== undefined) patch.venue_detail = a.venueDetail;
      if (a.location !== undefined && a.location.trim()) patch.location = a.location.trim();
      const u = await safe(db.from("checkpoints").update(patch).eq("code", a.code).select("code"), "checkpoint");
      return u.error ? err("Could not save the checkpoint.") : done();
    }
    case "rotate_token": {
      const u = await safe(db.from("checkpoints").update({ token: newToken() }).eq("code", a.code).select("code"), "rotate");
      return u.error ? err("Could not rotate the token.") : done();
    }
    case "team_create": {
      const customId = a.id ? canonicalTeamId(a.id) : null;
      if (a.id && !customId) return fail("BAD_INPUT", `"${a.id}" isn't a Team ID. Use T + number, e.g. T01 (zero, not the letter O).`, 400);
      const pw = a.password ? canonicalPassword(a.password) : "";
      if (a.password && (pw.length < 6 || pw.length > 12)) return fail("BAD_INPUT", "Password needs 6–12 letters or digits (symbols are ignored).", 400);
      if (customId === REHEARSAL_TEAM_ID) return fail("BAD_INPUT", "T00 is reserved for rehearsal.", 400);
      const c = await createTeam(db, env, { id: customId ?? undefined, password: pw || undefined, name: a.name, members: a.members.filter(Boolean) });
      if (!c.ok) return fail("FAILED", /duplicate|unique/i.test(c.error) ? `Team ID ${customId} already exists — pick another or leave it blank.` : "Could not create the team.", 409);
      return done({ id: c.id }, { id: c.id, password: c.password });
    }
    case "team_update": {
      const u = await safe(db.from("teams").update({ name: a.name, members: a.members.filter(Boolean) }).eq("id", a.id).select("id"), "team update");
      return u.error ? err("Could not update the team.") : done();
    }
    case "team_delete": {
      if (a.id === REHEARSAL_TEAM_ID) return fail("FORBIDDEN", "T00 is the rehearsal team — reset it instead.", 400);
      const u = await safe(db.from("teams").delete().eq("id", a.id).select("id"), "team delete");
      return u.error ? err("Could not delete the team.") : done();
    }
    case "team_reset_password": {
      const p = await resetPassword(db, env, a.id);
      if (!p.ok) return err("Could not reset the password.");
      return done({}, { id: a.id, password: p.password });
    }
    case "team_reset_progress": {
      const u = await rpc(db, "reset_team", { p_team_id: a.id });
      return u.error ? err("Could not reset progress.") : done();
    }
    case "team_disqualify": {
      const u = await safe(db.from("teams").update({ status: "DISQUALIFIED" }).eq("id", a.id).select("id"), "dq");
      return u.error ? err("Could not disqualify.") : done();
    }
    case "team_reinstate": {
      const t = await safe(db.from("teams").select("finished_at").eq("id", a.id).single(), "reinstate read");
      const finished = !!(t.data as { finished_at: string | null } | null)?.finished_at;
      const u = await safe(db.from("teams").update({ status: finished ? "FINISHED" : "ACTIVE" }).eq("id", a.id).select("id"), "reinstate");
      return u.error ? err("Could not reinstate.") : done();
    }
    case "team_adjust": {
      const ref = `adj:${crypto.randomUUID()}`;
      const u = await safe(db.from("score_entries").insert({ team_id: a.id, ref, marks: a.marks, source: "admin", reason: a.reason, actor }), "adjust");
      return u.error ? err("Could not adjust marks.") : done({ ref });
    }
    case "rehearsal_create": {
      const exists = await safe(db.from("teams").select("id").eq("id", REHEARSAL_TEAM_ID).maybeSingle(), "t00");
      if (exists.data) {
        const p = await resetPassword(db, env, REHEARSAL_TEAM_ID);
        return p.ok ? done({}, { id: REHEARSAL_TEAM_ID, password: p.password }) : err("Could not reset T00.");
      }
      const c = await createTeam(db, env, { id: REHEARSAL_TEAM_ID, name: "Rehearsal", members: ["Organisers"], rehearsal: true });
      return c.ok ? done({}, { id: c.id, password: c.password }) : err("Could not create T00.");
    }
    case "rehearsal_simulate": {
      const ctx = await loadCtx(db, REHEARSAL_TEAM_ID);
      if (ctx.error || !ctx.data) return fail("NO_T00", "Create the rehearsal team T00 first.", 400);
      const cp = ctx.data.checkpoints.find((c) => c.code === a.code);
      if (!cp) return fail("NO_CP", "Unknown checkpoint.", 400);
      const logs: { team_id: string | null; cp_code: string | null; result: string; device_id: string | null }[] = [];
      const view = await scan(db, ctx.data, cp.token, "admin-sim", (row) => logs.push(row));
      if (logs.length) await safe(db.from("scan_logs").insert(logs), "sim log");
      return done({ result: logs[0]?.result ?? view.kind }, { result: logs[0]?.result ?? view.kind, view: view.kind });
    }
    case "rehearsal_reset": {
      const u = await rpc(db, "reset_team", { p_team_id: REHEARSAL_TEAM_ID });
      return u.error ? err("Could not reset T00.") : done();
    }
    case "reg_import": {
      // One registration → one team per request (keeps each Worker call inside the free-plan CPU budget).
      const reg = await safe(db.from("registrations").select("id, team_name, members, status").eq("id", a.id).single(), "reg read");
      if (reg.error || !reg.data) return fail("NOT_FOUND", "Registration not found.", 404);
      const g = reg.data as { id: number; team_name: string; members: string[]; status: string };
      if (g.status !== "PENDING") return fail("DONE", `"${g.team_name}" was already handled.`, 409);
      const c = await createTeam(db, env, { name: g.team_name, members: g.members });
      if (!c.ok) return err(`Could not create a team for "${g.team_name}".`);
      await safe(db.from("registrations").update({ status: "IMPORTED", team_id: c.id }).eq("id", g.id).select("id"), "reg mark");
      return done({ id: c.id, reg: g.id }, { id: c.id, name: g.team_name, password: c.password });
    }
    case "reg_reject":
    case "reg_restore": {
      const u = await safe(
        db.from("registrations").update({ status: a.type === "reg_reject" ? "REJECTED" : "PENDING" }).eq("id", a.id).neq("status", "IMPORTED").select("id"),
        "reg status",
      );
      return u.error ? err("Could not update the registration (is the name now taken?).") : done();
    }
    case "reset_all": {
      const u = await rpc(db, "reset_all");
      return u.error ? err("Could not reset.") : done();
    }
  }
});
