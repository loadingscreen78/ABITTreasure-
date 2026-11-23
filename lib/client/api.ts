"use client";

/** Device id (random, per browser) — lets organisers see how many phones a team uses. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem("abit-device");
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, "");
      localStorage.setItem("abit-device", id);
    }
    return id;
  } catch {
    return "nostorage-device";
  }
}

export function newIdemKey(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9-]/g, "");
}

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; code: string; message: string; status: number; view?: unknown };

const BACKOFF = [400, 1000, 2000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * JSON fetch with up to 3 retries (400 ms, 1 s, 2 s) on network errors and 5xx.
 * The caller passes the SAME body (incl. idempotency key) every time, so a retried submit can
 * never count twice. Never throws.
 */
export async function api<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; onRetry?: (n: number) => void; signal?: AbortSignal } = {},
): Promise<ApiOk<T> | ApiErr> {
  const method = opts.method ?? (opts.body === undefined ? "GET" : "POST");
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", "x-device-id": deviceId() },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        cache: "no-store",
        credentials: "same-origin",
        signal: opts.signal,
      });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }
      if (res.status >= 500 && attempt < BACKOFF.length && data?.code !== "SETUP") {
        opts.onRetry?.(attempt + 1);
        await sleep(BACKOFF[attempt]!);
        continue;
      }
      if (data && data.ok === true) return data as ApiOk<T>;
      return {
        ok: false,
        code: String(data?.code ?? (res.ok ? "BAD_RESPONSE" : `HTTP_${res.status}`)),
        message: String(data?.message ?? "Weak signal — retrying…"),
        status: res.status,
        view: data?.view,
      };
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return { ok: false, code: "ABORTED", message: "", status: 0 };
      if (attempt < BACKOFF.length) {
        opts.onRetry?.(attempt + 1);
        await sleep(BACKOFF[attempt]!);
        continue;
      }
      return { ok: false, code: "OFFLINE", message: "Weak signal — check your connection and tap Retry.", status: 0 };
    }
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
