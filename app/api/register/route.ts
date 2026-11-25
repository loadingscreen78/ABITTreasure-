import { z } from "zod";
import { readEnv } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { PASSWORD_ALPHABET } from "@/lib/game/ids";
import { withDefaults } from "@/lib/game/scoring";
import { rpc, safe } from "@/lib/server/db";
import { clientIp, deviceId, fail, handler, json, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const Body = z.object({
  teamName: z.string().trim().min(2, "Give your team a name (at least 2 characters).").max(60),
  members: z.array(z.string().trim().max(60)).max(4),
  agree: z.literal(true, { message: "Please confirm your team has read the rules." }),
});

const ref = () => {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return "R-" + Array.from(b, (x) => PASSWORD_ALPHABET[x % PASSWORD_ALPHABET.length]).join("");
};

/** Public team registration from the home page. Only team + member names are collected. */
export const POST = handler("register", async (req: Request) => {
  const e = readEnv();
  if (!e.ok) return fail("SETUP", "Registration is warming up — please try again in a minute or ask a volunteer.", 503);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("BAD_INPUT", parsed.error.issues[0]?.message ?? "Check the form and try again.", 400);
  const members = parsed.data.members.map((m) => m.replace(/\s+/g, " ")).filter(Boolean);
  if (members.length < 3) return fail("BAD_INPUT", "Teams need 3–4 members. Add at least 3 names.", 400);
  const names = members.map((m) => m.toLowerCase());
  if (new Set(names).size !== names.length) return fail("BAD_INPUT", "Each member name should appear only once.", 400);
  const teamName = parsed.data.teamName.replace(/\s+/g, " ");

  const db = adminClient(e.env);
  // Campus Wi-Fi shares one public IP, so: a generous per-IP cap plus a tight per-device cap.
  const [byIp, byDevice] = await Promise.all([
    rpc<boolean>(db, "throttle_hit", { p_key: `reg-ip:${clientIp(req)}`, p_limit: 60, p_window_seconds: 600 }),
    rpc<boolean>(db, "throttle_hit", { p_key: `reg-dev:${deviceId(req) ?? clientIp(req)}`, p_limit: 5, p_window_seconds: 600 }),
  ]);
  if (byIp.error || byDevice.error) return fail("NETWORK", "Weak signal — please try again.", 503);
  if (!byIp.data || !byDevice.data) return fail("THROTTLED", "Too many registrations from this phone. Wait a few minutes or ask a volunteer.", 429);

  const ev = await safe(db.from("event_state").select("settings").eq("id", 1).single(), "reg settings");
  if (ev.error) return fail("NETWORK", "Weak signal — please try again.", 503);
  if (!withDefaults((ev.data as unknown as { settings: Record<string, unknown> }).settings).registrationOpen)
    return fail("CLOSED", "Registration is closed. Please speak to the organisers at the registration desk.", 403);

  const clash = await safe(db.from("teams").select("id").ilike("name", teamName.replace(/[%_]/g, "\\$&")).limit(1), "reg clash");
  if (!clash.error && Array.isArray(clash.data) && clash.data.length) return fail("TAKEN", `A team called "${teamName}" already exists. Pick another name.`, 409);

  for (let i = 0; i < 3; i++) {
    const r = ref();
    const ins = await db.from("registrations").insert({ team_name: teamName, members, ref: r }).select("ref").single();
    if (!ins.error) return json({ ok: true, ref: r, teamName, members });
    if (ins.error.code === "23505" && /name/i.test(ins.error.message)) return fail("TAKEN", `A team called "${teamName}" is already registered. Pick another name.`, 409);
    if (ins.error.code !== "23505") {
      console.error("[register] insert:", ins.error.message);
      return fail("NETWORK", "Couldn't save your registration. Please try again.", 503);
    }
  }
  return fail("NETWORK", "Couldn't save your registration. Please try again.", 503);
});
