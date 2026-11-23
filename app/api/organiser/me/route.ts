import { handler, json } from "@/lib/server/http";
import { organiserRequest } from "@/lib/server/organiser-route";

export const dynamic = "force-dynamic";

export const GET = handler("organiser/me", async () => {
  const r = await organiserRequest(["admin", "judge"]);
  if (!r.ok) return r.res;
  return json({ ok: true, role: r.org.role, email: r.org.email });
});
