/**
 * npm run seed                          → load content/hunt.json (keeps existing QR tokens) + ensure T00
 * npm run seed -- --teams teams.csv     → also create teams from CSV (name,member1..4) and print credentials ONCE
 * npm run seed -- --rotate-tokens       → new QR tokens for every checkpoint (breaks printed QR cards!)
 * npm run seed -- --reset-settings      → overwrite admin-changed settings with hunt.json settings
 * npm run seed -- --t00-password        → issue a new password for rehearsal team T00
 * npm run seed -- --file content/x.json → load a different content file
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { HuntSchema, TIE_BREAKERS } from "../lib/content/schema";
import { huntToRows } from "../lib/content/rows";
import { formatPassword, newPassword, newToken, REHEARSAL_TEAM_ID, teamIdFor } from "../lib/game/ids";
import { hashPassword } from "../lib/auth/password";
import { sealText } from "../lib/auth/secretbox";
import { parseTeamsCsv } from "../lib/csv";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COST = Number(process.env.BCRYPT_COST ?? 5);
if (!URL_ || !KEY || !SESSION_SECRET) {
  console.error("seed: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and SESSION_SECRET must be set in .env.local");
  process.exit(1);
}
const db = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function die(msg: string, e?: { message?: string } | null): never {
  console.error(`seed: ${msg}${e?.message ? ` — ${e.message}` : ""}`);
  process.exit(1);
}

async function main() {
  const file = opt("--file") ?? "content/hunt.json";
  const hunt = HuntSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  console.log(`seed: loaded ${file} — ${hunt.checkpoints.length} checkpoints, ${hunt.checkpoints.flatMap((c) => c.questions).length} questions`);

  // --- event state ---
  const { data: ev, error: evErr } = await db.from("event_state").select("settings").eq("id", 1).single();
  if (evErr) die("cannot read event_state (did you run `npm run db:push`?)", evErr);
  const current = (ev?.settings ?? {}) as Record<string, unknown>;
  const settings = flag("--reset-settings") || Object.keys(current).length === 0 ? { ...hunt.settings } : { ...hunt.settings, ...current };
  if (process.env.SECRET_WORD && (flag("--reset-settings") || Object.keys(current).length === 0)) settings.secretWord = process.env.SECRET_WORD;
  const { error: upErr } = await db.from("event_state").update({ settings, event: hunt.event, tie_breakers: TIE_BREAKERS, updated_at: new Date().toISOString() }).eq("id", 1);
  if (upErr) die("cannot update event_state", upErr);

  // --- checkpoints (keep printed tokens unless --rotate-tokens) ---
  const { data: existing, error: exErr } = await db.from("checkpoints").select("code, token");
  if (exErr) die("cannot read checkpoints", exErr);
  const tokens: Record<string, string> = {};
  for (const c of hunt.checkpoints) {
    const prev = existing?.find((x) => x.code === c.code)?.token;
    tokens[c.code] = flag("--rotate-tokens") || !prev ? newToken() : prev;
  }
  const { checkpoints, questions } = huntToRows(hunt, tokens);
  const { error: cpErr } = await db.from("checkpoints").upsert(checkpoints, { onConflict: "code" });
  if (cpErr) die("cannot upsert checkpoints", cpErr);
  const { error: qErr } = await db.from("questions").upsert(questions, { onConflict: "id" });
  if (qErr) die("cannot upsert questions", qErr);
  const keepQ = questions.map((q) => q.id);
  await db.from("questions").delete().not("id", "in", `(${keepQ.join(",")})`);
  console.log(`seed: checkpoints + questions upserted${flag("--rotate-tokens") ? " (tokens ROTATED — reprint QR cards)" : " (tokens kept)"}`);

  // --- rehearsal team T00 ---
  const { data: t00 } = await db.from("teams").select("id").eq("id", REHEARSAL_TEAM_ID).maybeSingle();
  const lines: string[] = [];
  if (!t00 || flag("--t00-password")) {
    const pw = newPassword();
    const row = { password_hash: await hashPassword(pw, COST), password_enc: await sealText(pw, SESSION_SECRET!), session_version: Date.now() % 100000 };
    const { error } = t00
      ? await db.from("teams").update(row).eq("id", REHEARSAL_TEAM_ID)
      : await db.from("teams").insert({ id: REHEARSAL_TEAM_ID, name: "Rehearsal", members: ["Organisers"], is_rehearsal: true, ...row });
    if (error) die("cannot create T00", error);
    lines.push(`${REHEARSAL_TEAM_ID}\tRehearsal\t${formatPassword(pw)}`);
  }

  // --- teams from CSV ---
  const csvPath = opt("--teams");
  if (csvPath) {
    const rows = parseTeamsCsv(readFileSync(csvPath, "utf8"));
    const { data: ids } = await db.from("teams").select("id");
    let n = Math.max(0, ...(ids ?? []).map((x) => Number(String(x.id).slice(1))).filter(Number.isFinite)) + 1;
    for (const r of rows) {
      const id = teamIdFor(n++);
      const pw = newPassword();
      const { error } = await db.from("teams").insert({
        id,
        name: r.name.slice(0, 60),
        members: r.members,
        password_hash: await hashPassword(pw, COST),
        password_enc: await sealText(pw, SESSION_SECRET!),
      });
      if (error) die(`cannot create team ${r.name}`, error);
      lines.push(`${id}\t${r.name}\t${formatPassword(pw)}`);
    }
    console.log(`seed: created ${rows.length} teams from ${csvPath}`);
  }

  // --- print the QR URLs + new credentials once ---
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  console.log("\nCheckpoint QR URLs:");
  for (const c of checkpoints) console.log(`  ${c.code}  ${base}/s/${c.token}`);
  if (lines.length) {
    const out = `credentials-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    writeFileSync(out, "TEAM\tNAME\tPASSWORD\n" + lines.join("\n") + "\n");
    console.log(`\nNEW CREDENTIALS (shown once; also saved to ${out}, which is gitignored — delete it after printing):`);
    for (const l of lines) console.log("  " + l.replace(/\t/g, "  "));
  }
  console.log("\nseed: done.");
}

main().catch((e) => die("failed", e));
