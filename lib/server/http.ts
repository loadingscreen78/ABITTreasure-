import "server-only";
import { NextResponse } from "next/server";

export function json<T>(body: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...(headers ?? {}) } });
}

export function fail(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ ok: false, code, message, ...extra }, status);
}

/** Wraps a route handler: any thrown error becomes a typed JSON 500, logged without secrets. */
export function handler<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(`[${name}]`, e instanceof Error ? e.message : "unknown error");
      return fail("SERVER", "Something went wrong on our side. Retrying…", 500);
    }
  };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function deviceId(req: Request): string | null {
  const d = req.headers.get("x-device-id");
  return d && /^[A-Za-z0-9-]{6,48}$/.test(d) ? d : null;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const isSecure = (req: Request) => new URL(req.url).protocol === "https:";
