"use client";
import useSWR from "swr";
import { api } from "@/lib/client/api";

/** SWR polling every 3 s (no websockets). Keeps the last good data while offline. */
export function usePoll<T>(path: string | null, interval = 3000) {
  return useSWR<T>(
    path,
    async (p: string) => {
      const r = await api<T>(p);
      if (!r.ok) throw Object.assign(new Error(r.message), { code: r.code });
      return r as T;
    },
    { refreshInterval: interval, revalidateOnFocus: true, keepPreviousData: true, errorRetryInterval: 3000 },
  );
}

export async function act(body: Record<string, unknown>) {
  return api<Record<string, unknown>>("/api/admin/action", { body });
}
