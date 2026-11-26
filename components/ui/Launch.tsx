"use client";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./brand";
import { useNow } from "./live";

/**
 * Launch sequence shown on every team phone and on the projector when the admin presses START:
 * full-screen countdown (pulsing rings, sweeping tape, progress bar) → "THE HUNT IS LIVE" burst.
 * Stays up `holdMs` after zero, then calls onDone. Server time is used via skewMs.
 */
export function LaunchOverlay({
  startsAt,
  skewMs,
  onDone,
  onZero,
  holdMs = 2600,
  big = false,
  note = "Scan the CP—01 QR at the registration desk",
}: {
  startsAt: string;
  skewMs: number;
  onDone: () => void;
  onZero?: () => void;
  holdMs?: number;
  big?: boolean;
  note?: string;
}) {
  const now = useNow(100);
  const target = new Date(startsAt).getTime();
  const left = target - (now + skewMs);
  const secs = Math.max(0, Math.ceil(left / 1000));
  const [total] = useState(() => Math.max(1, Math.ceil((target - (Date.now() + skewMs)) / 1000)));
  const live = left <= 0;
  const fired = useRef(false);

  useEffect(() => {
    if (!live || fired.current) return;
    fired.current = true;
    try {
      navigator.vibrate?.([80, 40, 80, 40, 220]);
    } catch {
      /* ignore */
    }
    onZero?.();
    const id = setTimeout(onDone, holdMs);
    return () => clearTimeout(id);
  }, [live, onDone, onZero, holdMs]);

  useEffect(() => {
    if (live || secs > 3) return;
    try {
      navigator.vibrate?.(25);
    } catch {
      /* ignore */
    }
  }, [secs, live]);

  const tape = "Launch sequence · case file TTH · CODE2CAREER · ABIT Cuttack · Decode · Discover · Win · ";
  return (
    <div className="launch" role="alertdialog" aria-live="assertive" aria-label={live ? "The hunt is live" : `The hunt starts in ${secs} seconds`}>
      <div className="launch-tape t1" aria-hidden>
        <span>{tape.repeat(6)}</span>
      </div>
      <div className="launch-tape t2" aria-hidden>
        <span>{tape.repeat(6)}</span>
      </div>
      {live && <span className="launch-flash" aria-hidden />}
      {!live && (
        <>
          <span className="launch-ring" aria-hidden key={`r1-${secs}`} />
          <span className="launch-ring r2" aria-hidden key={`r2-${secs}`} />
        </>
      )}
      <div className="launch-inner">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <Wordmark size={big ? "lg" : "md"} />
        </div>
        {live ? (
          <>
            <div className="t-meta" style={{ fontSize: big ? 18 : 12, marginBottom: 18 }}>
              Field link established
            </div>
            <span className="launch-live">
              The hunt
              <br />
              is live
            </span>
            <p style={{ margin: "26px 0 0", fontSize: big ? 30 : 18, fontWeight: 600 }}>{note}</p>
          </>
        ) : (
          <>
            <div className="t-meta" style={{ fontSize: big ? 18 : 12 }}>
              The hunt goes live in
            </div>
            <div key={secs} className={`launch-num${secs <= 3 ? " is-final" : ""}`}>
              {String(secs).padStart(2, "0")}
            </div>
            <div className="launch-bar" aria-hidden>
              <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, 1 - left / (total * 1000)))})` }} />
            </div>
            <p className="t-meta" style={{ margin: "16px 0 0", fontSize: big ? 16 : 11, opacity: 0.75 }}>
              Stay with your team · phones ready
            </p>
          </>
        )}
      </div>
    </div>
  );
}
