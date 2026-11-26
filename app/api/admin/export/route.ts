import { toCsv } from "@/lib/csv";
import { safe } from "@/lib/server/db";
import { fail, handler } from "@/lib/server/http";
import { organiserRequest } from "@/lib/server/organiser-route";
import { loadSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";

const csv = (name: string, body: string) =>
  new Response("﻿" + body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });

export const GET = handler("admin/export", async (req: Request) => {
  const type = new URL(req.url).searchParams.get("type");
  const r = await organiserRequest(type === "judge" ? ["admin", "judge"] : ["admin"]);
  if (!r.ok) return r.res;
  if (type === "judge") {
    const snap = await loadSnapshot(r.db);
    if (!snap) return fail("NETWORK", "Database unreachable.", 503);
    const rows = snap.standings.map((s) => [s.id, s.name, s.clues, s.final, s.teamworkMarks, s.timeBonus, s.tieBreak || "", s.adjustMarks, s.total, s.rank ?? (s.status === "DISQUALIFIED" ? "DQ" : "")]);
    return csv(
      "judge-evaluation-sheet.csv",
      toCsv([["Team ID", "Team Name", "Clues /75", "Final /15", "Teamwork /5", "Time Bonus /5", "Tie-break", "Adjustments", "Total /100", "Rank"], ...rows]),
    );
  }
  if (type === "attempts") {
    const a = await safe(
      r.db.from("attempts").select("at, team_id, question_id, raw, normalized, correct, near_miss, attempt_no, device_id").order("at").limit(20000),
      "export attempts",
    );
    if (a.error) return fail("NETWORK", "Database unreachable.", 503);
    const rows = (a.data as Record<string, unknown>[]).map((x) => [x.at, x.team_id, x.question_id, x.raw, x.normalized, x.correct, x.near_miss, x.attempt_no, x.device_id] as (string | number | boolean | null)[]);
    return csv("attempts-log.csv", toCsv([["At", "Team", "Question", "Raw", "Normalized", "Correct", "Near miss", "Attempt #", "Device"], ...rows]));
  }
  return fail("BAD_INPUT", "type must be judge or attempts", 400);
});
