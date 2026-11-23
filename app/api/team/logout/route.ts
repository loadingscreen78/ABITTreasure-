import { cookies } from "next/headers";
import { TEAM_COOKIE } from "@/lib/auth/session";
import { handler, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = handler("team/logout", async () => {
  (await cookies()).delete(TEAM_COOKIE);
  return json({ ok: true });
});
