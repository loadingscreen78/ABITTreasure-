import { publicBaseUrl } from "@/lib/env";
import { fail, handler, json } from "@/lib/server/http";
import { organiserRequest } from "@/lib/server/organiser-route";
import { loadSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";

export const GET = handler("admin/snapshot", async () => {
  const r = await organiserRequest(["admin"]);
  if (!r.ok) return r.res;
  const snap = await loadSnapshot(r.db);
  if (!snap) return fail("NETWORK", "Could not reach the database. Retrying…", 503);
  const base = publicBaseUrl(r.env);
  return json({
    ok: true,
    ...snap,
    teams: snap.teams.map((t) => ({ ...t, scores: undefined })),
    checkpoints: snap.checkpoints.map((c) => ({ ...c, url: `${base}/s/${c.token}` })),
    me: { role: r.org.role, email: r.org.email },
  });
});
