"use client";
import { useState } from "react";
import { Strip } from "@/components/ui/kit";
import { parseTeamsCsv, toCsv } from "@/lib/csv";
import { readXlsx } from "@/lib/xlsx";
import { RegistrationsPanel } from "./Registrations";
import { OrgHeader, OrganiserGate } from "./OrganiserGate";
import { MiniPunch, type Snap } from "./AdminDashboard";
import { act, usePoll } from "./useOrgData";

export default function AdminTeams() {
  return (
    <OrganiserGate roles={["admin"]} title="Teams">
      {(me) => (
        <div className="dense">
          <OrgHeader me={me} here="/admin/teams" />
          <Teams />
        </div>
      )}
    </OrganiserGate>
  );
}

function Teams() {
  const { data, mutate, error } = usePoll<Snap>("/api/admin/snapshot", 5000);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [creds, setCreds] = useState<{ id: string; name: string; password: string }[]>([]);
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [customPw, setCustomPw] = useState("");
  const [members, setMembers] = useState(["", "", "", ""]);
  const [csv, setCsv] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const run = async (body: Record<string, unknown>, ok: string) => {
    const r = await act(body);
    setMsg(r.ok ? { tone: "ok", text: ok } : { tone: "error", text: r.message });
    void mutate();
    return r;
  };

  const create = async () => {
    const r = (await run({ type: "team_create", name, members: members.filter(Boolean), id: customId, password: customPw }, `Team "${name}" created.`)) as { ok: boolean; id?: string; password?: string };
    if (r.ok && r.id && r.password) {
      setCreds((c) => [...c, { id: r.id!, name, password: r.password! }]);
      setName("");
      setCustomId("");
      setCustomPw("");
      setMembers(["", "", "", ""]);
    }
  };

  // One request per team keeps each Worker invocation tiny (free-plan CPU limit).
  const importCsv = async () => {
    const rows = parseTeamsCsv(csv);
    if (!rows.length) return setMsg({ tone: "error", text: "No rows found. Format: name,member1,member2,member3,member4" });
    const out: typeof creds = [];
    for (const [i, row] of rows.entries()) {
      setProgress(`Creating ${i + 1} / ${rows.length}…`);
      const r = (await act({ type: "team_create", name: row.name, members: row.members })) as { ok: boolean; id?: string; password?: string; message?: string };
      if (!r.ok) {
        setMsg({ tone: "error", text: `Stopped at "${row.name}": ${r.message ?? "error"}. ${out.length} created.` });
        break;
      }
      out.push({ id: r.id!, name: row.name, password: r.password! });
    }
    setProgress(null);
    setCreds((c) => [...c, ...out]);
    if (out.length === rows.length) setMsg({ tone: "ok", text: `Imported ${out.length} teams.` });
    setCsv("");
    void mutate();
  };

  if (!data) return <div className="sheet-wide" style={{ paddingTop: 20 }}>{error ? <Strip tone="error">{String(error.message)}</Strip> : <p className="t-meta anim-blink">Loading teams…</p>}</div>;
  const standing = new Map(data.standings.map((s) => [s.id, s]));

  return (
    <div className="sheet-wide" style={{ paddingTop: 18, display: "grid", gap: 20 }}>
      {msg && <Strip tone={msg.tone === "ok" ? "ok" : "error"} live>{msg.text}</Strip>}
      {creds.length > 0 && (
        <section className="panel" style={{ borderColor: "var(--color-verified)" }}>
          <h2 className="t-display-sm">New credentials — shown once</h2>
          <p style={{ margin: "0 0 8px" }}>
            Copy these now, or print slips from <a href="/print/credentials">Print → Credential slips</a> (passwords stay re-printable there).
          </p>
          <table className="tbl">
            <thead>
              <tr>
                <th>Team ID</th>
                <th>Name</th>
                <th>Password</th>
              </tr>
            </thead>
            <tbody>
              {creds.map((c) => (
                <tr key={c.id + c.password}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td style={{ fontSize: 16, fontWeight: 600 }}>{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-paper btn-sm" style={{ marginTop: 10 }} onClick={() => setCreds([])}>
            Hide
          </button>
        </section>
      )}

      <RegistrationsPanel onCreds={(c) => setCreds((x) => [...x, ...c])} onChanged={() => void mutate()} />

      <div className="grid-2">
        <section className="panel">
          <h2 className="t-display-sm">Add a team</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <input className="input-box" placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Team name" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input className="input-box" placeholder="Team ID, e.g. T01 (blank = auto)" value={customId} onChange={(e) => setCustomId(e.target.value.toUpperCase())} aria-label="Team ID (optional)" maxLength={4} />
              <input className="input-box" placeholder="Password, 6–12 chars (blank = auto)" value={customPw} onChange={(e) => setCustomPw(e.target.value.toUpperCase())} aria-label="Password (optional)" maxLength={12} />
            </div>
            {members.map((m, i) => (
              <input key={i} className="input-box" placeholder={`Member ${i + 1}${i >= 3 ? " (optional)" : ""}`} value={m} onChange={(e) => setMembers(members.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Member ${i + 1}`} />
            ))}
            <button className="btn btn-ink btn-sm" disabled={!name.trim()} onClick={() => void create()}>
              Create team
            </button>
          </div>
        </section>
        <section className="panel">
          <h2 className="t-display-sm">Bulk import (Excel or CSV)</h2>
          <p style={{ margin: "0 0 8px" }}>
            Columns: <code>name,member1,member2,member3,member4</code>. IDs (T01, T02…) and passwords are generated. Team names and member names only — no phone numbers or emails.
          </p>
          <textarea className="input-box" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"name,member1,member2,member3,member4\nByte Bandits,Asha,Ravi,Sneha,"} aria-label="CSV" />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <label className="btn btn-paper btn-sm" style={{ cursor: "pointer" }}>
              Choose .xlsx / .csv
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    if (/\.xlsx$/i.test(f.name)) setCsv(toCsv(await readXlsx(await f.arrayBuffer())).replace(/\r\n$/, ""));
                    else setCsv(await f.text());
                    setMsg({ tone: "ok", text: `Loaded ${f.name} — check the rows, then press Import.` });
                  } catch (x) {
                    setMsg({ tone: "error", text: x instanceof Error ? x.message : "Could not read that file." });
                  }
                }}
              />
            </label>
            <button className="btn btn-ink btn-sm" disabled={!csv.trim() || !!progress} onClick={() => void importCsv()}>
              {progress ?? "Import"}
            </button>
          </div>
        </section>
      </div>

      <section className="panel" style={{ overflowX: "auto" }}>
        <h2 className="t-display-sm">All teams ({data.teams.length})</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name / members</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => {
              const s = standing.get(t.id);
              return (
                <tr key={t.id}>
                  <td>
                    <strong>{t.id}</strong>
                  </td>
                  <td>
                    {editing === t.id ? <EditRow t={t} onSave={async (n, m) => { await run({ type: "team_update", id: t.id, name: n, members: m }, "Saved."); setEditing(null); }} onCancel={() => setEditing(null)} /> : (
                      <>
                        {t.name}
                        <div style={{ color: "var(--color-graphite)" }}>{t.members.join(", ")}</div>
                      </>
                    )}
                  </td>
                  <td>
                    <MiniPunch cleared={t.cleared} current={t.unlocked_cp} />
                  </td>
                  <td>
                    <span className={`pill ${t.status === "FINISHED" ? "pill-ok" : t.status === "DISQUALIFIED" ? "pill-err" : ""}`}>{t.status}</span>
                  </td>
                  <td>{s ? `${s.total} (adj ${s.adjustMarks >= 0 ? "+" : ""}${s.adjustMarks})` : t.is_rehearsal ? "rehearsal" : "—"}</td>
                  <td>
                    <div className="btn-row" style={{ gap: 4 }}>
                      <Mini onClick={() => setEditing(t.id)}>Edit</Mini>
                      <Mini
                        onClick={async () => {
                          if (!confirm(`New password for ${t.id}? Phones logged in as ${t.id} will be signed out.`)) return;
                          const r = (await run({ type: "team_reset_password", id: t.id }, `${t.id} password reset.`)) as { ok: boolean; password?: string };
                          if (r.ok && r.password) setCreds((c) => [...c, { id: t.id, name: t.name, password: r.password! }]);
                        }}
                      >
                        Reset pw
                      </Mini>
                      <Mini onClick={() => confirm(`Wipe ALL progress and marks for ${t.id}?`) && void run({ type: "team_reset_progress", id: t.id }, `${t.id} progress reset.`)}>Reset progress</Mini>
                      <Mini
                        onClick={() => {
                          const marks = prompt(`Adjust marks for ${t.id} (e.g. -5 or 3):`);
                          if (!marks || Number.isNaN(Number(marks))) return;
                          const reason = prompt("Reason (required, audit-logged):");
                          if (!reason || reason.trim().length < 3) return;
                          void run({ type: "team_adjust", id: t.id, marks: Math.trunc(Number(marks)), reason }, `${t.id} adjusted ${marks}.`);
                        }}
                      >
                        Adjust marks
                      </Mini>
                      {t.status === "DISQUALIFIED" ? (
                        <Mini onClick={() => void run({ type: "team_reinstate", id: t.id }, `${t.id} reinstated.`)}>Reinstate</Mini>
                      ) : (
                        <Mini
                          danger
                          onClick={() => {
                            const reason = prompt(`Disqualify ${t.id}? Reason (audit-logged):`);
                            if (reason && reason.trim().length >= 3) void run({ type: "team_disqualify", id: t.id, reason }, `${t.id} disqualified.`);
                          }}
                        >
                          Disqualify
                        </Mini>
                      )}
                      <a className="pill" href={`/print/team?id=${t.id}`} style={{ textDecoration: "none", padding: "6px 8px" }}>
                        Sheet
                      </a>
                      {!t.is_rehearsal && (
                        <Mini danger onClick={() => confirm(`Delete ${t.id} "${t.name}" permanently?`) && void run({ type: "team_delete", id: t.id }, `${t.id} deleted.`)}>
                          Delete
                        </Mini>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Mini({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`pill ${danger ? "pill-err" : ""}`} style={{ background: "var(--color-card)", cursor: "pointer", padding: "6px 8px", minHeight: 30 }} onClick={onClick}>
      {children}
    </button>
  );
}

function EditRow({ t, onSave, onCancel }: { t: { name: string; members: string[] }; onSave: (n: string, m: string[]) => void; onCancel: () => void }) {
  const [n, setN] = useState(t.name);
  const [m, setM] = useState([...t.members, "", "", "", ""].slice(0, 4));
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <input className="input-box" style={{ minHeight: 32, fontSize: 13 }} value={n} onChange={(e) => setN(e.target.value)} aria-label="Team name" />
      {m.map((x, i) => (
        <input key={i} className="input-box" style={{ minHeight: 32, fontSize: 13 }} value={x} onChange={(e) => setM(m.map((y, j) => (j === i ? e.target.value : y)))} aria-label={`Member ${i + 1}`} />
      ))}
      <div className="btn-row" style={{ gap: 4 }}>
        <Mini onClick={() => onSave(n, m.filter(Boolean))}>Save</Mini>
        <Mini onClick={onCancel}>Cancel</Mini>
      </div>
    </div>
  );
}
