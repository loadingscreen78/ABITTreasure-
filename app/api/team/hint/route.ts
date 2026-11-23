import { z } from "zod";
import { fail, handler, json, readJson } from "@/lib/server/http";
import { hint } from "@/lib/server/team";
import { teamRequest } from "@/lib/server/team-route";

export const dynamic = "force-dynamic";

const Body = z.object({ clue: z.number().int().min(1).max(15) });

export const POST = handler("team/hint", async (req: Request) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("BAD_INPUT", "No nudge for that.", 400);
  const tr = await teamRequest();
  if (tr.kind !== "team") return fail("LOGIN", "Please log in again.", 401);
  const nudge = await hint(tr.db, tr.ctx, parsed.data.clue);
  if (!nudge) return fail("NO_NUDGE", "No nudge available right now.", 404);
  return json({ ok: true, nudge });
});
