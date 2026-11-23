"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Footer, Wordmark } from "@/components/ui/brand";
import { IconArrow, IconLock } from "@/components/ui/icons";
import { ErrorLine, Strip } from "@/components/ui/kit";
import { api } from "@/lib/client/api";

export type Role = "admin" | "judge";
type Me = { role: Role; email: string | null };
type State = { kind: "loading" } | { kind: "login"; msg?: string } | { kind: "forbidden"; msg: string } | { kind: "setup"; msg: string } | { kind: "offline" } | { kind: "ok"; me: Me };

async function supabase() {
  const cfg = await api<{ url: string; publishableKey: string }>("/api/organiser/config");
  if (!cfg.ok) throw new Error(cfg.message);
  const { browserClient } = await import("@/lib/supabase/client");
  return browserClient(cfg.url, cfg.publishableKey);
}

export async function signOut() {
  try {
    const sb = await supabase();
    await sb.auth.signOut();
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/** Supabase Auth gate for /admin, /judge and /print. The server re-checks the role on every API call. */
export function OrganiserGate({ roles, title, children }: { roles: Role[]; title: string; children: (me: Me) => ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const check = useCallback(async () => {
    const r = await api<{ role: Role; email: string | null }>("/api/organiser/me");
    if (r.ok) {
      if (!roles.includes(r.role)) setState({ kind: "forbidden", msg: `Signed in as ${r.role}. This page needs ${roles.join(" or ")}.` });
      else setState({ kind: "ok", me: { role: r.role, email: r.email } });
    } else if (r.code === "SETUP") setState({ kind: "setup", msg: r.message });
    else if (r.code === "AUTH") setState({ kind: "login" });
    else if (r.code === "FORBIDDEN") setState({ kind: "forbidden", msg: "This account has no organiser role. Ask the admin to set app_metadata.role." });
    else setState({ kind: "offline" });
  }, [roles]);

  useEffect(() => {
    const id = setTimeout(() => void check(), 0);
    return () => clearTimeout(id);
  }, [check]);

  if (state.kind === "ok") return <>{children(state.me)}</>;
  return (
    <main className="sheet anim-rise">
      <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" }}>
        <Wordmark size="sm" />
        <span>Organisers only</span>
      </div>
      <hr className="rule-2" />
      <h1 className="t-display" style={{ margin: "22px 0 10px", fontSize: 40 }}>
        {title}
      </h1>
      {state.kind === "loading" && <p className="t-meta anim-blink">Checking access…</p>}
      {state.kind === "setup" && (
        <Strip tone="error">
          <strong>Setup incomplete.</strong> {state.msg}. Add the missing values to the Cloudflare Worker settings (or .env.local) and redeploy.
        </Strip>
      )}
      {state.kind === "offline" && (
        <>
          <Strip tone="error">Can&apos;t reach the server.</Strip>
          <button className="btn btn-ink" style={{ marginTop: 16 }} onClick={() => void check()}>
            Retry <IconArrow />
          </button>
        </>
      )}
      {state.kind === "forbidden" && (
        <>
          <Strip tone="error">{state.msg}</Strip>
          <button className="btn btn-paper" style={{ marginTop: 16 }} onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      )}
      {state.kind === "login" && <LoginForm onDone={() => void check()} />}
      <Footer />
    </main>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const sb = await supabase();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setErr(error.message === "Invalid login credentials" ? "Email or password is wrong." : error.message);
      else onDone();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Sign-in failed.");
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 10 }}>
      <p className="t-meta" style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}>
        <IconLock size={14} /> Sign in with your organiser account
      </p>
      <div>
        <label className="t-meta field-label" htmlFor="org-email">
          Email
        </label>
        <input id="org-email" className="input-line" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="t-meta field-label" htmlFor="org-pw">
          Password
        </label>
        <input id="org-pw" className="input-line" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {err && (
        <Strip tone="error" live>
          <ErrorLine>{err}</ErrorLine>
        </Strip>
      )}
      <button className="btn btn-ink" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"} <IconArrow />
      </button>
    </form>
  );
}

export function OrgHeader({ me, here }: { me: Me; here: string }) {
  const links: [string, string, Role[]][] = [
    ["/admin", "Control", ["admin"]],
    ["/admin/teams", "Teams", ["admin"]],
    ["/judge", "Judge", ["admin", "judge"]],
    ["/board", "Board", ["admin", "judge"]],
    ["/print", "Print", ["admin", "judge"]],
  ];
  return (
    <header className="no-print" style={{ borderBottom: "2px solid var(--color-ink)", background: "var(--color-paper)" }}>
      <div className="sheet-wide" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "10px 20px" }}>
        <Wordmark size="sm" />
        <span className="t-meta">CODE2CAREER · Tech Treasure Hunt · Organisers</span>
        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: "auto" }} aria-label="Organiser">
          {links
            .filter(([, , r]) => r.includes(me.role))
            .map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="t-meta"
                aria-current={here === href ? "page" : undefined}
                style={{ padding: "10px 10px", textDecoration: "none", border: "1.5px solid var(--color-ink)", background: here === href ? "var(--color-ink)" : "var(--color-card)", color: here === href ? "var(--color-paper)" : "var(--color-ink)" }}
              >
                {label}
              </a>
            ))}
          <button className="t-meta" style={{ padding: "10px 10px", border: "1.5px solid var(--color-ink)", background: "var(--color-card)" }} onClick={() => void signOut()}>
            Sign out · {me.role}
          </button>
        </nav>
      </div>
    </header>
  );
}
