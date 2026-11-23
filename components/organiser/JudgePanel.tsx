"use client";
import { useState } from "react";
import { Strip } from "@/components/ui/kit";
import { api } from "@/lib/client/api";
import { clockTime, mmss } from "@/lib/game/format";
import { MiniPunch, type Standing } from "./AdminDashboard";
import { OrgHeader, OrganiserGate } from "./OrganiserGate";
import { usePoll } from "./useOrgData";

interface JTeam {
  id: string;
  name: string;
  status: string;
  cleared: number;
  unlockedCp: number;
  arrived: boolean;
  finishedAt: string | null;
  elapsedMs: number | null;
  judgeCode: string | null;
  teamwork: number | null;
  finalConfirmed: boolean;
  finalRevoked: boolean;
  standing: Standing | null;
}
interface JData {
  now: string;
  event: { status: string; startedAt: string | null; resultsRevealed: boolean };
  teams: JTeam[];
  tieBreakers: { q: string; a: string }[];
}

export default function JudgePanel() {
  return (
    <OrganiserGate roles={["admin", "judge"]} title="Finish desk">
      {(me) => (
        <div className="dense">
          <OrgHeader me={me} here="/judge" />
          <Judge />
        </div>
      )}
    </OrganiserGate>
  );
}

function Judge() {
  const { data, error, mutate } = usePoll<JData>("/api/judge");
  const [msg, setMsg] = useState<string | null>(null);
  const [showTie, setShowTie] = useState(false);
  const save = async (body: Record<string, unknown>, ok: string) => {
    const r = await api("/api/judge", { body });
    setMsg(r.ok ? ok : r.message);
    void mutate();
  };
  if (!data) return <div className="sheet-wide" style={{ paddingTop: 20 }}>{error ? <Strip tone="error">{String(error.message)}</Strip> : <p className="t-meta anim-blink">Loading…</p>}</div>;

  const finished = data.teams.filter((t) => t.status === "FINISHED").sort((a, b) => (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""));
  const arriving = data.teams.filter((t) => t.status === "ACTIVE" && t.unlockedCp === 8);

  return (
    <div className="sheet-wide" style={{ paddingTop: 18, display: "grid", gap: 20 }}>
      {msg && <Strip tone="note" live>{msg}</Strip>}
      <section className="panel">
        <h2 className="t-display-sm">At / heading to the finish desk ({arriving.length})</h2>
        {arriving.length === 0 ? (
          <p style={{ margin: 0 }}>No team is on the last leg right now.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {arriving.map((t) => (
              <li key={t.id}>
                <strong>{t.id}</strong> {t.name} — {t.arrived ? "scanned CP-08, entering the final phrase" : "heading here: show them the CP-08 QR"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" style={{ overflowX: "auto" }}>
        <h2 className="t-display-sm">Finished — verify &amp; score ({finished.length})</h2>
        <p style={{ margin: "0 0 10px" }}>Check the 4-digit code on the team&apos;s phone and hear the phrase aloud, then confirm the final and enter teamwork (0–5).</p>
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Finish time</th>
              <th>Elapsed</th>
              <th>Verify code</th>
              <th>Final (15)</th>
              <th>Teamwork 0–5</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {finished.map((t, i) => (
              <tr key={t.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{t.id}</strong> {t.name}
                </td>
                <td>{clockTime(t.finishedAt)}</td>
                <td>{mmss(t.elapsedMs)}</td>
                <td style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.1em" }}>{t.judgeCode}</td>
                <td>
                  {t.finalRevoked ? <span className="pill pill-err">revoked</span> : t.finalConfirmed ? <span className="pill pill-ok">confirmed</span> : <span className="pill">auto</span>}{" "}
                  <button className="pill" style={{ background: "var(--color-card)", cursor: "pointer", padding: "6px 8px" }} onClick={() => void save({ teamId: t.id, final: "confirm" }, `${t.id} final confirmed.`)}>
                    Confirm
                  </button>{" "}
                  <button className="pill pill-err" style={{ background: "var(--color-card)", cursor: "pointer", padding: "6px 8px" }} onClick={() => confirm(`Revoke ${t.id}'s final stage (−15)?`) && void save({ teamId: t.id, final: "revoke" }, `${t.id} final revoked.`)}>
                    Revoke
                  </button>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 3 }} role="group" aria-label={`Teamwork for ${t.id}`}>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        aria-pressed={t.teamwork === n}
                        onClick={() => void save({ teamId: t.id, teamwork: n }, `${t.id} teamwork ${n}.`)}
                        style={{ width: 32, height: 32, border: "1.5px solid var(--color-ink)", background: t.teamwork === n ? "var(--color-ink)" : "var(--color-card)", color: t.teamwork === n ? "var(--color-paper)" : "var(--color-ink)", fontFamily: "var(--font-mono)" }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </td>
                <td>{t.standing?.total ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid-2">
        <section className="panel" style={{ overflowX: "auto" }}>
          <h2 className="t-display-sm">Standings</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Clues /75</th>
                <th>Final /15</th>
                <th>TW /5</th>
                <th>Bonus /5</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.teams
                .filter((t) => t.standing)
                .sort((a, b) => (a.standing!.rank ?? 999) - (b.standing!.rank ?? 999))
                .map((t) => (
                  <tr key={t.id}>
                    <td>{t.standing!.rank ?? "DQ"}</td>
                    <td>
                      {t.id} {t.name} <MiniPunch cleared={t.cleared} current={t.unlockedCp} />
                    </td>
                    <td>{t.standing!.clues}</td>
                    <td>{t.standing!.final}</td>
                    <td>{t.standing!.teamworkMarks}</td>
                    <td>{t.standing!.timeBonus}</td>
                    <td>
                      <strong>{t.standing!.total}</strong>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2 className="t-display-sm">Tie-breakers</h2>
          <p style={{ margin: "0 0 8px" }}>Judge use only — never shown to teams.</p>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
            {data.tieBreakers.map((t) => (
              <li key={t.q}>
                {t.q}
                {showTie && <div className="t-mono" style={{ color: "var(--color-verified)" }}>→ {t.a}</div>}
              </li>
            ))}
          </ol>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-paper btn-sm" onClick={() => setShowTie((s) => !s)}>
              {showTie ? "Hide answers" : "Show answers"}
            </button>
            <a className="btn btn-paper btn-sm" href="/print/answer-key">
              Answer key
            </a>
            <a className="btn btn-paper btn-sm" href="/api/admin/export?type=judge">
              Judge sheet CSV
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
