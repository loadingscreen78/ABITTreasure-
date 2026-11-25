"use client";
import { useState } from "react";
import { Strip } from "@/components/ui/kit";
import { clockTime } from "@/lib/game/format";
import { act, usePoll } from "./useOrgData";

interface Reg {
  id: number;
  team_name: string;
  members: string[];
  status: "PENDING" | "IMPORTED" | "REJECTED";
  team_id: string | null;
  ref: string;
  created_at: string;
}

/** Student registrations from the home page → Excel export → teams with IDs + passwords. */
export function RegistrationsPanel({ onCreds, onChanged }: { onCreds: (c: { id: string; name: string; password: string }[]) => void; onChanged: () => void }) {
  const { data, mutate, error } = usePoll<{ registrations: Reg[]; counts: { pending: number; imported: number; rejected: number } }>("/api/admin/registrations", 5000);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [show, setShow] = useState<"PENDING" | "ALL">("PENDING");

  const importOne = async (r: Reg) => {
    const res = (await act({ type: "reg_import", id: r.id })) as { ok: boolean; id?: string; password?: string; message?: string };
    return res;
  };

  const importAll = async () => {
    const pending = (data?.registrations ?? []).filter((r) => r.status === "PENDING");
    if (!pending.length) return;
    if (!confirm(`Create ${pending.length} team(s) with new IDs and passwords from the pending registrations?`)) return;
    const out: { id: string; name: string; password: string }[] = [];
    for (const [i, r] of pending.entries()) {
      setProgress(`Creating ${i + 1} / ${pending.length}…`);
      const res = await importOne(r);
      if (!res.ok) {
        setMsg({ tone: "error", text: `Stopped at "${r.team_name}": ${res.message ?? "error"}. ${out.length} created.` });
        break;
      }
      out.push({ id: res.id!, name: r.team_name, password: res.password! });
    }
    setProgress(null);
    if (out.length) onCreds(out);
    if (out.length === pending.length) setMsg({ tone: "ok", text: `Created ${out.length} teams. Print their slips from Print → Credential slips.` });
    void mutate();
    onChanged();
  };

  const rows = (data?.registrations ?? []).filter((r) => show === "ALL" || r.status === "PENDING");

  return (
    <section className="panel" style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 14 }}>
        <h2 className="t-display-sm">Student registrations</h2>
        {data && (
          <span className="t-meta">
            {data.counts.pending} pending · {data.counts.imported} turned into teams · {data.counts.rejected} rejected
          </span>
        )}
      </div>
      <p style={{ margin: "6px 0 10px" }}>
        Teams register themselves on the home page. Download them as an Excel file (columns <code>name, member1…member4</code> — the same format the bulk import accepts), or create the teams right here.
      </p>
      {error && <Strip tone="error">{String(error.message)} — retrying…</Strip>}
      {msg && <Strip tone={msg.tone === "ok" ? "ok" : "error"} live>{msg.text}</Strip>}
      <div className="btn-row" style={{ margin: "10px 0 12px" }}>
        <a className="btn btn-ink btn-sm" href="/api/admin/registrations?format=xlsx">
          Download Excel (all)
        </a>
        <a className="btn btn-paper btn-sm" href="/api/admin/registrations?format=xlsx&status=pending">
          Download Excel (pending)
        </a>
        <button className="btn btn-paper btn-sm" disabled={!data?.counts.pending || !!progress} onClick={() => void importAll()}>
          {progress ?? `Create teams for all pending (${data?.counts.pending ?? 0})`}
        </button>
        <button className="btn btn-paper btn-sm" onClick={() => setShow(show === "ALL" ? "PENDING" : "ALL")}>
          {show === "ALL" ? "Show pending only" : "Show all"}
        </button>
      </div>
      {!data ? (
        <p className="t-meta anim-blink">Loading registrations…</p>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0 }}>No {show === "PENDING" ? "pending " : ""}registrations yet. Share the home page link with students.</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Team</th>
              <th>Members</th>
              <th>Registered</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.ref}</td>
                <td>
                  <strong>{r.team_name}</strong>
                </td>
                <td>{r.members.join(", ")}</td>
                <td>{clockTime(r.created_at)}</td>
                <td>
                  <span className={`pill ${r.status === "IMPORTED" ? "pill-ok" : r.status === "REJECTED" ? "pill-err" : ""}`}>{r.status === "IMPORTED" ? `team ${r.team_id}` : r.status}</span>
                </td>
                <td>
                  <div className="btn-row" style={{ gap: 4 }}>
                    {r.status === "PENDING" && (
                      <>
                        <button
                          className="pill"
                          style={{ background: "var(--color-card)", cursor: "pointer", padding: "6px 8px" }}
                          onClick={async () => {
                            const res = await importOne(r);
                            if (res.ok && res.id && res.password) {
                              onCreds([{ id: res.id, name: r.team_name, password: res.password }]);
                              setMsg({ tone: "ok", text: `"${r.team_name}" is now team ${res.id}.` });
                            } else setMsg({ tone: "error", text: res.message ?? "Could not create the team." });
                            void mutate();
                            onChanged();
                          }}
                        >
                          Create team
                        </button>
                        <button
                          className="pill pill-err"
                          style={{ background: "var(--color-card)", cursor: "pointer", padding: "6px 8px" }}
                          onClick={async () => {
                            if (!confirm(`Reject the registration "${r.team_name}"?`)) return;
                            await act({ type: "reg_reject", id: r.id });
                            void mutate();
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === "REJECTED" && (
                      <button
                        className="pill"
                        style={{ background: "var(--color-card)", cursor: "pointer", padding: "6px 8px" }}
                        onClick={async () => {
                          const res = await act({ type: "reg_restore", id: r.id });
                          if (!res.ok) setMsg({ tone: "error", text: res.message });
                          void mutate();
                        }}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
