"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, vibrate } from "@/lib/client/api";
import type { SubmitResult, TeamView } from "@/lib/types";
import { TeamShell } from "./TeamShell";
import { LoginPanel } from "./LoginPanel";
import { QuestionPanel } from "./QuestionPanel";
import { CluePanel, StartPanel } from "./CluePanel";
import { FinishPanel } from "./FinishPanel";
import { GatePanel, MessagePanel } from "./GatePanel";
import { Strip } from "@/components/ui/kit";

export interface Flash {
  marks: number;
  at: number;
}

type Net = "ok" | "retrying" | "offline";

function tokenFromPath(): string | null {
  const m = /^\/s\/([0-9A-Za-z]{4,16})\/?$/.exec(window.location.pathname);
  return m?.[1] ?? null;
}

/** The whole team-facing flow. All state comes from the server; nothing secret ships in this bundle. */
export default function TeamApp({ mode }: { mode: "scan" | "play" | "finish" }) {
  const [view, setView] = useState<TeamView | null>(null);
  const [skew, setSkew] = useState(0);
  const [net, setNet] = useState<Net>("ok");
  const [flash, setFlash] = useState<Flash | null>(null);
  const [punching, setPunching] = useState<number | null>(null);
  const lastCleared = useRef<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const accept = useCallback((v: TeamView) => {
    if ("header" in v && v.header) {
      setSkew(new Date(v.header.serverNow).getTime() - Date.now());
      const prev = lastCleared.current;
      if (prev !== null && v.header.cleared > prev) {
        setPunching(v.header.cleared);
        setTimeout(() => setPunching(null), 320);
      }
      lastCleared.current = v.header.cleared;
    }
    setView(v);
  }, []);

  const load = useCallback(async () => {
    const t = mode === "scan" ? tokenFromPath() : null;
    const onRetry = () => setNet("retrying");
    const r =
      mode === "scan"
        ? t
          ? await api<{ view: TeamView }>("/api/team/scan", { body: { token: t }, onRetry })
          : ({ ok: true, view: { kind: "invalid" } } as const)
        : await api<{ view: TeamView }>("/api/team/state", { onRetry });
    setToken(t);
    if (r.ok) {
      setNet("ok");
      accept(r.view);
    } else {
      setNet("offline");
      if (r.view) accept(r.view as TeamView);
    }
  }, [mode, accept]);

  useEffect(() => {
    // Deferred one tick so the first paint (shell + "Reading checkpoint…") is never blocked.
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  // Waiting states poll; every state refreshes when the phone comes back to the foreground.
  const kind = view?.kind;
  const gate = view?.kind === "gate" ? view.gate : null;
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    let id: ReturnType<typeof setInterval> | undefined;
    if (gate === "NOT_STARTED" || gate === "PAUSED") id = setInterval(() => void load(), 5000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (id) clearInterval(id);
    };
  }, [kind, gate, load]);

  const onSubmitted = useCallback(
    (result: SubmitResult, next: TeamView) => {
      if (result.outcome === "CORRECT") {
        vibrate(30);
        setFlash({ marks: result.marks ?? 0, at: Date.now() });
      }
      accept(next);
    },
    [accept],
  );

  const header = view && "header" in view ? view.header : null;

  let body: React.ReactNode;
  if (!view) {
    body = (
      <div style={{ padding: "40px 0" }}>
        <p className="t-meta anim-blink">{net === "retrying" ? "Weak signal — retrying…" : "Reading checkpoint…"}</p>
        {net === "offline" && (
          <button className="btn btn-ink" style={{ marginTop: 20 }} onClick={() => void load()}>
            Retry <span aria-hidden>→</span>
          </button>
        )}
      </div>
    );
  } else {
    switch (view.kind) {
      case "login":
        body = <LoginPanel cp={view.cp} reason={view.reason} token={token} onLoggedIn={() => void load()} />;
        break;
      case "question":
        body = <QuestionPanel key={view.question.id} view={view} skewMs={skew} flash={flash} onSubmitted={onSubmitted} onView={accept} />;
        break;
      case "clue":
        body = <CluePanel view={view} flash={flash} />;
        break;
      case "start":
        body = <StartPanel banner={view.banner} />;
        break;
      case "finished":
        return <FinishPanel view={view} />;
      case "gate":
        body = <GatePanel view={view} skewMs={skew} onTick={() => void load()} />;
        break;
      case "setup":
        body = <MessagePanel title="Warming up" text="Event system is warming up, please ask a volunteer." onRetry={() => void load()} />;
        break;
      case "invalid":
        body = <MessagePanel title="Unknown QR" text="This QR code isn't part of the hunt, or it has been replaced. Ask a volunteer." />;
        break;
      case "error":
        body = <MessagePanel title="Hold on" text={view.message} onRetry={() => void load()} />;
        break;
    }
  }

  return (
    <TeamShell header={header} skewMs={skew} punching={punching}>
      {net !== "ok" && view && (
        <div style={{ marginTop: 12 }}>
          <Strip tone={net === "offline" ? "error" : "note"} live>
            <span className="t-meta">{net === "offline" ? "Weak signal — tap Retry when you have coverage." : "Weak signal — retrying…"}</span>
            {net === "offline" && (
              <button className="btn btn-paper btn-sm" style={{ marginTop: 10 }} onClick={() => void load()}>
                Retry
              </button>
            )}
          </Strip>
        </div>
      )}
      {body}
    </TeamShell>
  );
}
