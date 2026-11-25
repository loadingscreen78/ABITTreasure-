import { z } from "zod";
import { fail, handler, json, readJson } from "@/lib/server/http";
import { buyHint } from "@/lib/server/team";
import { teamRequest } from "@/lib/server/team-route";

export const dynamic = "force-dynamic";

const Body = z.object({ questionId: z.string().regex(/^Q\d{2}$/), level: z.enum(["low", "medium", "high"]) });

/** Spend hint-wallet points on a paid hint for the current question. Atomic + idempotent in SQL. */
export const POST = handler("team/buy-hint", async (req: Request) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("BAD_INPUT", "That hint request couldn't be read.", 400);
  const tr = await teamRequest();
  if (tr.kind === "setup") return fail("SETUP", "Event system is warming up, please ask a volunteer.", 503);
  if (tr.kind === "error") return fail("NETWORK", "Weak signal — retrying…", 503);
  if (tr.kind === "anon") return fail("LOGIN", "Please log in again.", 401, { view: { kind: "login", cp: null, reason: tr.reason } });
  const r = await buyHint(tr.db, tr.ctx, parsed.data.questionId, parsed.data.level);
  if (!r.ok) return fail(r.code, r.message, r.code === "NETWORK" ? 503 : 409, { view: r.view });
  return json({ ok: true, text: r.text, view: r.view });
});
