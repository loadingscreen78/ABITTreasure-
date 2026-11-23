import { after } from "next/server";
import { z } from "zod";
import { withDefaults } from "@/lib/game/scoring";
import { safe } from "@/lib/server/db";
import { deviceId, fail, handler, json, readJson } from "@/lib/server/http";
import { cpOrderForToken, scan } from "@/lib/server/team";
import { teamRequest } from "@/lib/server/team-route";
import type { TeamView } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().regex(/^[0-9A-Za-z]{4,16}$/) });

// The QR page GET only renders a static shell. This POST is the only thing that can
// mark an arrival, so link previews / prefetchers that GET the URL change nothing.
export const POST = handler("team/scan", async (req: Request) => {
  const parsed = Body.safeParse(await readJson(req));
  const tr = await teamRequest();
  if (tr.kind === "setup") return json({ ok: true, view: { kind: "setup" } satisfies TeamView });
  if (!parsed.success) return json({ ok: true, view: { kind: "invalid" } satisfies TeamView });
  const token = parsed.data.token;
  if (tr.kind === "error") return fail("NETWORK", "Weak signal — retrying…", 503);
  if (tr.kind === "anon") {
    const order = await cpOrderForToken(tr.db, token);
    const view: TeamView = order === null ? { kind: "invalid" } : { kind: "login", cp: order, reason: tr.reason };
    return json({ ok: true, view });
  }
  const { ctx, db, session } = tr;
  if (withDefaults(ctx.event.settings).loginEveryScan && session.st !== token) {
    const cp = ctx.checkpoints.find((c) => c.token === token);
    const view: TeamView = cp ? { kind: "login", cp: cp.order, reason: "every-scan" } : { kind: "invalid" };
    return json({ ok: true, view });
  }
  const logs: { team_id: string | null; cp_code: string | null; result: string; device_id: string | null }[] = [];
  const view = await scan(db, ctx, token, deviceId(req), (row) => logs.push(row));
  if (logs.length) {
    after(async () => {
      await safe(db.from("scan_logs").insert(logs), "scan log");
    });
  }
  return json({ ok: true, view });
});
