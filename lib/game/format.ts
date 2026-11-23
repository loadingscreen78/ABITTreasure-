/** Display helpers shared by server and client. Contains no game content. */

export const cpLabel = (order: number) => `CP—${String(order).padStart(2, "0")}`;
export const cpCode = (order: number) => `CP-${String(order).padStart(2, "0")}`;

export function mmss(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "--:--";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

export function ago(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
