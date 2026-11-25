"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconArrow, IconCheck } from "@/components/ui/icons";
import { ErrorLine, Stamp, Strip } from "@/components/ui/kit";
import { api } from "@/lib/client/api";

interface Done {
  ref: string;
  teamName: string;
  members: string[];
}
const KEY = "abit-registration";

/** Team self-registration. Saved server-side; organisers export it to Excel from /admin/teams. */
export function RegisterForm() {
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState(["", "", "", ""]);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved) setDone(JSON.parse(saved) as Done);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const filled = members.filter((m) => m.trim()).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (teamName.trim().length < 2) return setError("Give your team a name.");
    if (filled < 3) return setError("Teams need 3–4 members. Add at least 3 names.");
    if (!agree) return setError("Please confirm your team has read the rules.");
    setBusy(true);
    const r = await api<Done>("/api/register", { body: { teamName, members, agree } });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    const d = { ref: r.ref, teamName: r.teamName, members: r.members };
    setDone(d);
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  };

  if (done)
    return (
      <section className="card anim-rise" style={{ padding: 18, position: "relative" }} aria-live="polite">
        <span className="tape t-meta" style={{ position: "absolute", top: -12, left: 14 }}>
          Registration slip
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 6 }}>
          <div>
            <div className="t-meta" style={{ color: "var(--color-verified)", display: "flex", gap: 6, alignItems: "center" }}>
              <IconCheck size={14} /> Registered
            </div>
            <div className="t-display-sm" style={{ marginTop: 8 }}>
              {done.teamName}
            </div>
          </div>
          <Stamp animate size={18}>
            Filed
          </Stamp>
        </div>
        <ul style={{ margin: "12px 0 0", paddingLeft: 18 }}>
          {done.members.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <div className="perf" style={{ margin: "14px -18px 12px" }} aria-hidden />
        <div className="t-meta">Your reference</div>
        <div className="t-mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.08em" }}>
          {done.ref}
        </div>
        <p style={{ margin: "10px 0 0" }}>Show this at the registration desk on the day to collect your Team ID and password slip.</p>
        <button
          type="button"
          className="btn btn-paper"
          style={{ marginTop: 16 }}
          onClick={() => {
            try {
              localStorage.removeItem(KEY);
            } catch {
              /* ignore */
            }
            setDone(null);
            setTeamName("");
            setMembers(["", "", "", ""]);
            setAgree(false);
          }}
        >
          Register another team <IconArrow />
        </button>
      </section>
    );

  return (
    <section className="card" style={{ padding: 18, position: "relative" }} aria-labelledby="reg-title">
      <span className="tape t-meta" style={{ position: "absolute", top: -12, left: 14 }}>
        Enlist your team
      </span>
      <h2 id="reg-title" className="t-display-sm" style={{ margin: "8px 0 4px" }}>
        Register
      </h2>
      <p style={{ margin: "0 0 14px", color: "var(--color-graphite)", fontSize: 15 }}>3–4 students · 2nd year · team names and member names only.</p>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="t-meta field-label" htmlFor="reg-team">
            Team name
          </label>
          <input id="reg-team" className="input-line" value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={60} autoComplete="off" placeholder="e.g. Byte Bandits" />
        </div>
        {members.map((m, i) => (
          <div key={i}>
            <label className="t-meta field-label" htmlFor={`reg-m${i}`}>
              Member {i + 1}
              {i === 3 ? " (optional)" : ""}
            </label>
            <input
              id={`reg-m${i}`}
              className="input-line"
              value={m}
              onChange={(e) => setMembers(members.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="words"
            />
          </div>
        ))}
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", minHeight: 48, cursor: "pointer" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: "#121212" }} />
          <span>
            Our team has read the{" "}
            <Link href="/rules" style={{ fontWeight: 600 }}>
              rules
            </Link>{" "}
            and will stay together.
          </span>
        </label>
        {error && (
          <Strip tone="error" live>
            <ErrorLine>{error}</ErrorLine>
          </Strip>
        )}
        <button className="btn btn-ink" type="submit" disabled={busy}>
          {busy ? "Filing…" : "Register team"} <IconArrow />
        </button>
        <p className="t-meta" style={{ margin: 0, color: "var(--color-graphite)" }}>
          {filled}/4 members · saved for the organisers
        </p>
      </form>
    </section>
  );
}
