"use client";
import { useState } from "react";
import { Strip } from "@/components/ui/kit";
import { Countdown, useNow } from "@/components/ui/live";
import { ago, clockTime, mmss } from "@/lib/game/format";
import { OrgHeader, OrganiserGate } from "./OrganiserGate";
import { act, usePoll } from "./useOrgData";

export interface SnapTeam {
  id: string;
  name: string;
  members: string[];
  status: "ACTIVE" | "FINISHED" | "DISQUALIFIED";
  unlocked_cp: number;
  arrived: boolean;
  is_rehearsal: boolean;
  finished_at: string | null;
  last_activity_at: string | null;
  wrongCurrent: number;
  hintsUsed: number;
  devices: number;
  flags: string[];
  cleared: number;
  elapsedMs: number | null;
  teamwork: number | null;
}
export interface Standing {
  id: string;
  name: string;
  status: string;
  clues: number;
  final: number;
  teamworkMarks: number;
  timeBonus: number;
  adjustMarks: number;
  total: number;
  rank: number | null;
  elapsedMs: number | null;
}
export interface Snap {
  now: string;
  event: {
    status: "DRAFT" | "LIVE" | "PAUSED" | "ENDED";
    started_at: string | null;
    ends_at: string | null;
    results_revealed: boolean;
    settings: Record<string, unknown> & { secretWord: string; loginEveryScan: boolean; showScoresOnBoard: boolean; timeBonusMode: string; fullMarksWithinAttempts: number; cooldownSecondsAfterLimit: number; hintPenalty: number; timeLimitMinutes: number };
  };
  checkpoints: { code: string; order: number; token: string; location: string; venueDetail: string | null; url: string }[];
  teams: SnapTeam[];
  standings: Standing[];
  stations: { code: string; order: number; cleared: number; heading: number; atNow: number; medianMs: number | null; crowded: boolean }[];
}

export function MiniPunch({ cleared, current }: { cleared: number; current: number }) {
  return (
    <span className="mini-punch" aria-label={`${cleared} of 8 cleared`}>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={i + 1 <= cleared ? "is-done" : i + 1 === current ? "is-current" : ""} />
      ))}
    </span>
  );
}

export default function AdminDashboard() {
  return (
    <OrganiserGate roles={["admin"]} title="Event control">
      {(me) => (
        <div className="dense">
          <OrgHeader me={me} here="/admin" />
          <Dashboard />
        </div>
      )}
    </OrganiserGate>
  );
}

function Dashboard() {
  const { data, error, mutate } = usePoll<Snap>("/api/admin/snapshot");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const now = useNow(1000);

  const run = async (body: Record<string, unknown>, ok: string) => {
    const r = await act(body);
    setMsg(r.ok ? { tone: "ok", text: ok } : { tone: "error", text: r.message });
    void mutate();
    return r;
  };

  if (!data) return <div className="sheet-wide" style={{ paddingTop: 20 }}>{error ? <Strip tone="error">{String(error.message)} — retrying…</Strip> : <p className="t-meta anim-blink">Loading live ops…</p>}</div>;
  const ev = data.event;
  const skew = new Date(data.now).getTime() - now;
  const players = data.teams.filter((t) => !t.is_rehearsal);
  const startsIn = ev.status === "LIVE" && ev.started_at && new Date(ev.started_at).getTime() > now + skew;

  const start = async () => {
    const r = await run({ type: "event", action: "START", delaySeconds: 3 }, "Hunt started.");
    if (r.ok) setCountdown(new Date(Date.now() + 3000).toISOString());
  };

  return (
    <div className="sheet-wide" style={{ paddingTop: 18, display: "grid", gap: 20 }}>
      {countdown && (
        <div className="overlay" onClick={() => setCountdown(null)}>
          <div style={{ textAlign: "center" }}>
            <div className="t-numeral" style={{ fontSize: 220, color: "var(--color-paper)" }}>
              <Countdown until={countdown} skewMs={0} onDone={() => setTimeout(() => setCountdown(null), 600)} />
            </div>
            <p className="t-display-sm">The hunt is live</p>
          </div>
        </div>
      )}
      {error && <Strip tone="error">Connection problem — showing last data. {String(error.message)}</Strip>}
      {msg && <Strip tone={msg.tone === "ok" ? "ok" : "error"} live>{msg.text}</Strip>}

      <section className="panel">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 18 }}>
          <h2 className="t-display-sm">Status: {startsIn ? "Starting" : ev.status}</h2>
          <span className="t-meta">
            Started {clockTime(ev.started_at)} · {ev.started_at && !startsIn ? `elapsed ${mmss(now + skew - new Date(ev.started_at).getTime())}` : "—"}
            {ev.ends_at ? ` · ends ${clockTime(ev.ends_at)}` : ""}
          </span>
          <span className="t-meta">
            {players.length} teams · {players.filter((t) => t.status === "FINISHED").length} finished · results {ev.results_revealed ? "REVEALED" : "hidden"}
          </span>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          {(ev.status === "DRAFT" || ev.status === "ENDED") && (
            <button className="btn btn-ink btn-sm" onClick={() => void start()}>
              Start (3-2-1)
            </button>
          )}
          {ev.status === "LIVE" && (
            <button className="btn btn-paper btn-sm" onClick={() => void run({ type: "event", action: "PAUSE" }, "Paused.")}>
              Pause
            </button>
          )}
          {ev.status === "PAUSED" && (
            <button className="btn btn-ink btn-sm" onClick={() => void run({ type: "event", action: "RESUME" }, "Resumed.")}>
              Resume
            </button>
          )}
          {(ev.status === "LIVE" || ev.status === "PAUSED") && (
            <button className="btn btn-danger btn-sm" onClick={() => confirm("End the hunt for everyone?") && void run({ type: "event", action: "END" }, "Ended.")}>
              End
            </button>
          )}
          <button className="btn btn-paper btn-sm" onClick={() => void run({ type: "event", action: ev.results_revealed ? "HIDE" : "REVEAL" }, ev.results_revealed ? "Results hidden." : "Results revealed on the board.")}>
            {ev.results_revealed ? "Hide results" : "Reveal results"}
          </button>
          <a className="btn btn-paper btn-sm" href="/api/health" target="_blank" rel="noreferrer">
            Health check
          </a>
        </div>
      </section>

      <section className="panel" style={{ overflowX: "auto" }}>
        <h2 className="t-display-sm">Live ops</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Team</th>
              <th>Progress</th>
              <th>CP</th>
              <th>Arrived</th>
              <th>Wrong now</th>
              <th>Hints</th>
              <th>Last activity</th>
              <th>Phones</th>
              <th>Status</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => (
              <tr key={t.id} className={t.flags.length ? "is-flagged" : undefined}>
                <td>
                  <strong>{t.id}</strong> {t.name}
                  {t.is_rehearsal && <span className="pill" style={{ marginLeft: 6 }}>rehearsal</span>}
                </td>
                <td>
                  <MiniPunch cleared={t.cleared} current={t.unlocked_cp} />
                </td>
                <td>{t.status === "FINISHED" ? "DONE" : `CP-${String(t.unlocked_cp).padStart(2, "0")}`}</td>
                <td>{t.arrived ? "yes" : "no"}</td>
                <td>{t.wrongCurrent}</td>
                <td>{t.hintsUsed}</td>
                <td>{ago(t.last_activity_at, now + skew)}</td>
                <td>{t.devices}</td>
                <td>
                  <span className={`pill ${t.status === "FINISHED" ? "pill-ok" : t.status === "DISQUALIFIED" ? "pill-err" : ""}`}>{t.status}</span>
                </td>
                <td>{t.flags.join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 className="t-display-sm">Station health</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>CP</th>
                <th>Cleared</th>
                <th>Heading there</th>
                <th>At station</th>
                <th>Median stay</th>
              </tr>
            </thead>
            <tbody>
              {data.stations.map((s) => (
                <tr key={s.code} className={s.crowded ? "is-flagged" : undefined}>
                  <td>{s.code}</td>
                  <td>{s.cleared}</td>
                  <td>{s.heading}</td>
                  <td>{s.atNow}</td>
                  <td>
                    {mmss(s.medianMs)} {s.crowded && <span className="pill pill-signal">crowding</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <SettingsPanel snap={data} onSaved={() => void mutate()} run={run} />
      </div>

      <div className="grid-2">
        <CheckpointsPanel snap={data} run={run} />
        <RehearsalPanel snap={data} run={run} />
      </div>

      <section className="panel">
        <h2 className="t-display-sm">Exports &amp; printables</h2>
        <div className="btn-row">
          <a className="btn btn-paper btn-sm" href="/api/admin/export?type=judge">Judge sheet CSV</a>
          <a className="btn btn-paper btn-sm" href="/api/admin/export?type=attempts">Attempts log CSV</a>
          <a className="btn btn-paper btn-sm" href="/print/judge-sheet">Judge sheet (print)</a>
          <a className="btn btn-paper btn-sm" href="/print/team">All team answer sheets</a>
          <a className="btn btn-paper btn-sm" href="/print">All printables</a>
        </div>
      </section>
    </div>
  );
}

type Run = (body: Record<string, unknown>, ok: string) => Promise<{ ok: boolean }>;

function SettingsPanel({ snap, run }: { snap: Snap; onSaved: () => void; run: Run }) {
  const s = snap.event.settings;
  const [word, setWord] = useState("");
  const [limit, setLimit] = useState(String(s.timeLimitMinutes ?? 0));
  const toggle = (key: string, value: unknown, label: string) => void run({ type: "settings", patch: { [key]: value } }, `${label} saved.`);
  return (
    <section className="panel">
      <h2 className="t-display-sm">Settings</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label className="t-meta field-label" htmlFor="sw">
            Volunteer secret word (current: <strong>{s.secretWord}</strong>)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="sw" className="input-box" value={word} onChange={(e) => setWord(e.target.value.toUpperCase())} placeholder="NEW WORD" />
            <button className="btn btn-ink btn-sm" disabled={word.trim().length < 2} onClick={() => void run({ type: "settings", patch: { secretWord: word.trim() } }, "Secret word changed — reprint the volunteer QR.").then(() => setWord(""))}>
              Save
            </button>
          </div>
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.loginEveryScan} onChange={(e) => toggle("loginEveryScan", e.target.checked, "Login every scan")} /> Force login on every scan
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={s.showScoresOnBoard} onChange={(e) => toggle("showScoresOnBoard", e.target.checked, "Board scores")} /> Show scores on board during the hunt
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          Time bonus mode
          <select className="input-box" style={{ width: "auto", minHeight: 40 }} value={s.timeBonusMode} onChange={(e) => toggle("timeBonusMode", e.target.value, "Time bonus mode")}>
            <option value="tiered">Tiered 5 / 3 / 1</option>
            <option value="tiebreak">Time as tie-breaker only</option>
          </select>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          Full marks within
          <select className="input-box" style={{ width: "auto", minHeight: 40 }} value={s.fullMarksWithinAttempts} onChange={(e) => toggle("fullMarksWithinAttempts", Number(e.target.value), "Attempt policy")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} attempts
              </option>
            ))}
          </select>
          cooldown
          <select className="input-box" style={{ width: "auto", minHeight: 40 }} value={s.cooldownSecondsAfterLimit} onChange={(e) => toggle("cooldownSecondsAfterLimit", Number(e.target.value), "Cooldown")}>
            {[0, 10, 15, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n}s
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          Hint penalty
          <select className="input-box" style={{ width: "auto", minHeight: 40 }} value={s.hintPenalty} onChange={(e) => toggle("hintPenalty", Number(e.target.value), "Hint penalty")}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} marks
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label htmlFor="tl">Time limit (minutes, 0 = none, applied at START)</label>
          <input id="tl" className="input-box" style={{ width: 90 }} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} />
          <button className="btn btn-paper btn-sm" onClick={() => void run({ type: "settings", patch: { timeLimitMinutes: Number(limit || 0) } }, "Time limit saved.")}>
            Save
          </button>
        </div>
      </div>
    </section>
  );
}

function CheckpointsPanel({ snap, run }: { snap: Snap; run: Run }) {
  const [edit, setEdit] = useState<Record<string, string>>({});
  return (
    <section className="panel" style={{ overflowX: "auto" }}>
      <h2 className="t-display-sm">Checkpoints &amp; venues</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th>CP</th>
            <th>Location</th>
            <th>Exact spot (venue)</th>
            <th>QR</th>
          </tr>
        </thead>
        <tbody>
          {snap.checkpoints.map((c) => (
            <tr key={c.code}>
              <td>{c.code}</td>
              <td>{c.location}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="input-box" style={{ minHeight: 36, fontSize: 13 }} value={edit[c.code] ?? c.venueDetail ?? ""} onChange={(e) => setEdit({ ...edit, [c.code]: e.target.value })} aria-label={`Venue for ${c.code}`} />
                  <button className="btn btn-paper btn-sm" style={{ minHeight: 36 }} onClick={() => void run({ type: "checkpoint", code: c.code, venueDetail: edit[c.code] ?? c.venueDetail ?? "" }, `${c.code} venue saved.`)}>
                    Save
                  </button>
                </div>
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <code>/s/{c.token}</code>{" "}
                <button
                  className="pill"
                  style={{ background: "var(--color-card)", cursor: "pointer" }}
                  onClick={() => confirm(`Rotate the ${c.code} token? Printed QR cards for ${c.code} will STOP working and must be reprinted.`) && void run({ type: "rotate_token", code: c.code }, `${c.code} token rotated — reprint its card.`)}
                >
                  rotate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RehearsalPanel({ snap, run }: { snap: Snap; run: Run }) {
  const t00 = snap.teams.find((t) => t.id === "T00");
  const [confirmText, setConfirmText] = useState("");
  const [cred, setCred] = useState<string | null>(null);
  return (
    <section className="panel">
      <h2 className="t-display-sm">Rehearsal</h2>
      <p style={{ margin: "0 0 10px" }}>
        Test team <strong>T00</strong> can play even before START and never appears on the board or in results.{" "}
        {t00 ? `Now at CP-${String(t00.unlocked_cp).padStart(2, "0")}${t00.arrived ? " (arrived)" : ""} · ${t00.status}` : "Not created yet."}
      </p>
      <div className="btn-row">
        <button
          className="btn btn-paper btn-sm"
          onClick={async () => {
            const r = (await run({ type: "rehearsal_create" }, "T00 ready.")) as { ok: boolean; password?: string };
            if (r.ok && r.password) setCred(`T00 password: ${r.password}`);
          }}
        >
          {t00 ? "New T00 password" : "Create T00"}
        </button>
        <button className="btn btn-paper btn-sm" onClick={() => void run({ type: "rehearsal_reset" }, "T00 reset.")}>
          Reset T00
        </button>
      </div>
      {cred && (
        <div style={{ marginTop: 10 }}>
          <Strip tone="ok">{cred} (shown once)</Strip>
        </div>
      )}
      <p className="t-meta" style={{ margin: "14px 0 6px" }}>
        Simulate a T00 scan
      </p>
      <div className="btn-row">
        {snap.checkpoints.map((c) => (
          <button key={c.code} className="btn btn-paper btn-sm" style={{ minWidth: 0 }} onClick={() => void run({ type: "rehearsal_simulate", code: c.code }, `Simulated T00 scan at ${c.code}.`)}>
            {c.code}
          </button>
        ))}
      </div>
      <hr className="rule-1" style={{ margin: "16px 0" }} />
      <p className="t-meta" style={{ margin: "0 0 6px", color: "var(--color-error)" }}>
        Danger · reset ALL progress (every team + event back to DRAFT)
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input-box" placeholder="Type RESET" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Type RESET to confirm" />
        <button className="btn btn-danger btn-sm" disabled={confirmText !== "RESET"} onClick={() => void run({ type: "reset_all", confirm: "RESET" }, "All progress reset.").then(() => setConfirmText(""))}>
          Reset all
        </button>
      </div>
    </section>
  );
}
