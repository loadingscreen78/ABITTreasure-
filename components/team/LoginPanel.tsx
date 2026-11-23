"use client";
import { useState } from "react";
import { IconArrow, IconEye, IconLock } from "@/components/ui/icons";
import { ErrorLine, Strip } from "@/components/ui/kit";
import { api } from "@/lib/client/api";
import { cpLabel } from "@/lib/game/format";

export function LoginPanel({ cp, reason, token, onLoggedIn }: { cp: number | null; reason?: "expired" | "every-scan"; token: string | null; onLoggedIn: () => void }) {
  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await api<{ teamId: string }>("/api/team/login", { body: { teamId, password, token: token ?? undefined } });
    setBusy(false);
    if (r.ok) return onLoggedIn();
    setError(r.message);
    setShake(true);
    setTimeout(() => setShake(false), 320);
  };

  return (
    <div>
      {cp !== null && (
        <p className="t-meta" style={{ margin: "18px 0 0", display: "flex", alignItems: "center", gap: 8 }}>
          <IconLock size={14} /> Checkpoint detected · {cpLabel(cp)}
        </p>
      )}
      {reason === "expired" && <p style={{ margin: "10px 0 0", color: "var(--color-graphite)" }}>You were signed out on this phone. Log in again.</p>}
      {reason === "every-scan" && <p style={{ margin: "10px 0 0", color: "var(--color-graphite)" }}>Log in to unlock this checkpoint.</p>}

      <form onSubmit={submit} style={{ marginTop: 18, display: "grid", gap: 18 }} noValidate>
        <div>
          <label className="t-meta field-label" htmlFor="team-id">
            Team ID
          </label>
          <input
            id="team-id"
            className="input-line"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value.toUpperCase())}
            placeholder="T__"
            autoComplete="username"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            maxLength={5}
            required
          />
        </div>
        <div>
          <label className="t-meta field-label" htmlFor="team-pw">
            Password
          </label>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <input
              id="team-pw"
              className={`input-line${shake ? " anim-shake" : ""}`}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value.toUpperCase())}
              placeholder="••••-•••"
              autoComplete="current-password"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={9}
              required
            />
            <button
              type="button"
              className="btn btn-paper btn-sm"
              onClick={() => setShow((s) => !s)}
              aria-pressed={show}
              aria-controls="team-pw"
              style={{ minWidth: 84 }}
            >
              <IconEye size={16} /> {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error && (
          <Strip tone="error" live>
            <ErrorLine>{error}</ErrorLine>
          </Strip>
        )}
        <button className="btn btn-ink" type="submit" disabled={busy || !teamId || password.length < 4}>
          {busy ? "Checking…" : cp !== null ? "Unlock checkpoint" : "Log in"} <IconArrow />
        </button>
      </form>
      <p style={{ margin: "16px 0 0", color: "var(--color-graphite)", fontSize: 15 }}>Lost your slip? Find a volunteer.</p>
    </div>
  );
}
