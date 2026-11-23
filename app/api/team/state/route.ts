import { fail, handler, json } from "@/lib/server/http";
import { buildView } from "@/lib/server/team";
import { teamRequest } from "@/lib/server/team-route";
import type { TeamView } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Read-only: the team's current state for /play and /finish. */
export const GET = handler("team/state", async () => {
  const tr = await teamRequest();
  if (tr.kind === "setup") return json({ ok: true, view: { kind: "setup" } satisfies TeamView });
  if (tr.kind === "error") return fail("NETWORK", "Weak signal — retrying…", 503);
  if (tr.kind === "anon") return json({ ok: true, view: { kind: "login", cp: null, reason: tr.reason } satisfies TeamView });
  return json({ ok: true, view: buildView(tr.ctx) });
});
