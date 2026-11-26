"use client";
import { useEffect, useState } from "react";

/** Shared, content-free public status (event state + game settings shown on the home page). */
export interface PublicStatus {
  status: string;
  startedAt: string | null;
  enlisted: number | null;
  registrationOpen: boolean;
  now: string;
  fullMarksWithinAttempts?: number;
  answerRateLimit?: number;
  timeLimitMinutes?: number;
  skew: number;
}

let cache: PublicStatus | null = null;
let inflight: Promise<void> | null = null;
const subs = new Set<(s: PublicStatus) => void>();

async function load() {
  try {
    const r = await fetch("/api/public/status", { cache: "no-store" });
    const d = (await r.json()) as Omit<PublicStatus, "skew">;
    cache = { ...d, skew: new Date(d.now).getTime() - Date.now() };
    subs.forEach((f) => f(cache!));
  } catch {
    /* offline: keep last */
  }
}

export function usePublicStatus(): PublicStatus | null {
  const [s, setS] = useState<PublicStatus | null>(cache);
  useEffect(() => {
    subs.add(setS);
    if (!inflight) {
      inflight = load();
      setInterval(() => void load(), 30_000);
    } else if (cache) {
      const id = setTimeout(() => setS(cache), 0);
      return () => {
        clearTimeout(id);
        subs.delete(setS);
      };
    }
    return () => void subs.delete(setS);
  }, []);
  return s;
}

/** Renders a live setting value (e.g. tries for full marks) with a sensible fallback. */
export function LiveSetting({ k, fallback }: { k: "fullMarksWithinAttempts" | "answerRateLimit" | "timeLimitMinutes"; fallback: number }) {
  const s = usePublicStatus();
  const v = s?.[k];
  return <>{typeof v === "number" ? v : fallback}</>;
}
