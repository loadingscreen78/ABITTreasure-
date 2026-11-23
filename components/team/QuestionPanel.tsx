"use client";
import { useEffect, useRef, useState } from "react";
import { IconArrow, IconCheck } from "@/components/ui/icons";
import { ArrivedChip, CodeBlock, CpNumeral, ErrorLine, QuestionCard, Stamp, Strip } from "@/components/ui/kit";
import { Countdown, useNow } from "@/components/ui/live";
import { api, newIdemKey, vibrate } from "@/lib/client/api";
import type { SubmitResult, TeamView } from "@/lib/types";
import { BannerStrip } from "./Banner";
import type { Flash } from "./TeamApp";

type QView = Extract<TeamView, { kind: "question" }>;
type Feedback = { tone: "error" | "note" | "ok"; text: string; extra?: string; until?: string | null } | null;

const draftKey = (id: string) => `abit-draft-${id}`;

export function QuestionPanel({
  view,
  skewMs,
  flash,
  onSubmitted,
  onView,
}: {
  view: QView;
  skewMs: number;
  flash: Flash | null;
  onSubmitted: (r: SubmitResult, v: TeamView) => void;
  onView: (v: TeamView) => void;
}) {
  const q = view.question;
  const [answer, setAnswer] = useState(() => {
    try {
      return sessionStorage.getItem(draftKey(q.id)) ?? "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [shake, setShake] = useState(0);
  const idem = useRef<{ key: string; answer: string } | null>(null);
  const now = useNow(500);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(q.id), answer);
    } catch {
      /* private mode */
    }
  }, [answer, q.id]);

  const cooling = q.cooldownUntil && new Date(q.cooldownUntil).getTime() > now + skewMs ? q.cooldownUntil : null;
  const scoringLeft = q.wrongCount < q.fullWithin;
  const recentFlash = flash && now - flash.at < 6000 ? flash : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || cooling) return;
    if (!answer.trim()) {
      setFeedback({ tone: "note", text: "Type an answer first." });
      inputRef.current?.focus();
      return;
    }
    // Same answer re-submitted after a network failure → same idempotency key.
    if (!idem.current || idem.current.answer !== answer) idem.current = { key: newIdemKey(), answer };
    setBusy(true);
    setFeedback(null);
    const r = await api<{ result: SubmitResult; view: TeamView }>("/api/team/submit", {
      body: { questionId: q.id, answer, idemKey: idem.current.key },
      onRetry: () => setRetrying(true),
    });
    setBusy(false);
    setRetrying(false);
    if (!r.ok) {
      if (r.view) return onView(r.view as TeamView);
      setFeedback({ tone: "error", text: r.code === "OFFLINE" ? "Weak signal — your answer is kept. Tap Submit again." : r.message });
      return;
    }
    idem.current = null;
    const res = r.result;
    switch (res.outcome) {
      case "CORRECT":
        try {
          sessionStorage.removeItem(draftKey(q.id));
        } catch {
          /* ignore */
        }
        return onSubmitted(res, r.view);
      case "WRONG": {
        vibrate([60, 40, 60]);
        setShake((n) => n + 1);
        const left = res.attemptsLeft ?? 0;
        if (res.scoring && left > 0) {
          setFeedback({ tone: "error", text: `INCORRECT — ${left} attempt${left === 1 ? "" : "s"} left for full marks.` });
        } else {
          setFeedback({ tone: "error", text: "INCORRECT — keep going, this clue no longer scores.", until: res.cooldownUntil ?? null });
        }
        onView(r.view);
        return;
      }
      case "NEAR_MISS":
        setFeedback({ tone: "note", text: res.message ?? "Close — try again.", extra: "(no attempt used)" });
        return;
      case "COOLDOWN":
        setFeedback({ tone: "error", text: "Locked for a moment.", until: res.cooldownUntil ?? null });
        onView(r.view);
        return;
      case "EMPTY":
        setFeedback({ tone: "note", text: "Type an answer first." });
        return;
      default:
        onView(r.view);
    }
  };

  return (
    <div>
      <BannerStrip banner={view.banner} />
      {recentFlash && view.banner !== "ANOTHER_PHONE" && (
        <div style={{ margin: "18px 0 0", display: "flex", alignItems: "center", gap: 14 }} role="status">
          <Stamp animate>Verified</Stamp>
          <span className="t-meta" style={{ color: "var(--color-verified)" }}>
            <IconCheck size={14} style={{ verticalAlign: "-2px" }} /> {recentFlash.marks > 0 ? `+${recentFlash.marks}` : "clue unlocked"} · next question
          </span>
        </div>
      )}
      <div style={{ marginTop: 18 }}>
        <CpNumeral order={view.cp.order} />
      </div>
      {view.cp.arrival && (
        <div style={{ marginTop: 12 }}>
          <ArrivedChip label={view.cp.arrival.answer} marks={view.cp.arrival.marks} />
        </div>
      )}
      {view.cp.note && <p style={{ margin: "12px 0 0" }}>{view.cp.note}</p>}

      <div style={{ marginTop: 18 }}>
        <QuestionCard clue={q.clue} title={q.title}>
          <p style={{ margin: 0 }}>{q.prompt}</p>
          {q.code && (
            <div style={{ marginTop: 12 }}>
              <CodeBlock code={q.code} />
            </div>
          )}
        </QuestionCard>
      </div>

      <form onSubmit={submit} style={{ marginTop: 26 }} noValidate>
        <label className="t-meta field-label" htmlFor="answer">
          Your answer
        </label>
        <input
          ref={inputRef}
          key={shake}
          id="answer"
          className={`input-line${shake ? " anim-shake" : ""}`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={120}
          aria-describedby="attempt-note"
          aria-invalid={feedback?.tone === "error"}
        />
        <p id="attempt-note" className="t-meta" style={{ margin: "8px 0 14px", color: "var(--color-graphite)" }}>
          {scoringLeft ? `Attempt ${q.wrongCount + 1} of ${q.fullWithin} for full marks` : "This clue no longer scores — solve it to continue"}
        </p>
        {feedback && (
          <div style={{ marginBottom: 14 }}>
            <Strip tone={feedback.tone === "error" ? "error" : feedback.tone === "ok" ? "ok" : "note"} live>
              {feedback.tone === "error" ? <ErrorLine>{feedback.text}</ErrorLine> : <span>{feedback.text}</span>}
              {feedback.extra && <span className="t-meta" style={{ display: "block", marginTop: 4 }}>{feedback.extra}</span>}
              {feedback.until && new Date(feedback.until).getTime() > now + skewMs && (
                <span style={{ display: "block", marginTop: 4 }}>
                  Try again in <Countdown until={feedback.until} skewMs={skewMs} />.
                </span>
              )}
            </Strip>
          </div>
        )}
        <button className="btn btn-ink" type="submit" disabled={busy || !!cooling}>
          {cooling ? (
            <span>
              Locked · <Countdown until={cooling} skewMs={skewMs} />
            </span>
          ) : busy ? (
            retrying ? "Weak signal — retrying…" : "Checking…"
          ) : q.isFinal ? (
            "Claim the treasure"
          ) : (
            "Submit answer"
          )}
          <IconArrow />
        </button>
        {q.total > 1 && (
          <p className="t-meta" style={{ margin: "12px 0 0" }}>
            {q.index + 1} of {q.total} at this checkpoint
          </p>
        )}
      </form>
    </div>
  );
}
