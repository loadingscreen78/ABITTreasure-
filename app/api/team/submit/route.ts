import { z } from "zod";
import { deviceId, fail, handler, json, readJson } from "@/lib/server/http";
import { submit } from "@/lib/server/team";
import { teamRequest } from "@/lib/server/team-route";

export const dynamic = "force-dynamic";

const Body = z.object({
  questionId: z.string().regex(/^Q\d{2}$/),
  answer: z.string().max(400),
  idemKey: z
    .string()
    .regex(/^[A-Za-z0-9-]{8,64}$/)
    .nullable()
    .optional(),
});

export const POST = handler("team/submit", async (req: Request) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("BAD_INPUT", "That answer couldn't be read. Try again.", 400);
  const tr = await teamRequest();
  if (tr.kind === "setup") return fail("SETUP", "Event system is warming up, please ask a volunteer.", 503, { view: { kind: "setup" } });
  if (tr.kind === "error") return fail("NETWORK", "Weak signal — retrying…", 503);
  if (tr.kind === "anon") return fail("LOGIN", "Please log in again.", 401, { view: { kind: "login", cp: null, reason: tr.reason } });
  const out = await submit(
    tr.db,
    tr.ctx,
    { questionId: parsed.data.questionId, answer: parsed.data.answer, idemKey: parsed.data.idemKey ?? null },
    deviceId(req),
  );
  return json({ ok: true, ...out });
});
