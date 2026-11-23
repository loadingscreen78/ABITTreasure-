import type { Banner } from "@/lib/types";

/** WRONG TURN / ALREADY CLEARED / ANOTHER PHONE strips. */
export function BannerStrip({ banner }: { banner: Banner }) {
  if (banner === "WRONG_TURN")
    return (
      <div className="strip strip-signal anim-slide" role="status" style={{ marginTop: 16 }}>
        <div className="t-display" style={{ color: "var(--color-ink)", fontSize: 40 }}>
          <span style={{ background: "var(--color-signal)", padding: "0 6px" }}>Wrong turn</span>
        </div>
        <p style={{ margin: "10px 0 0" }}>This isn&apos;t your next checkpoint. Your current clue ↓</p>
      </div>
    );
  if (banner === "ALREADY_CLEARED")
    return (
      <div className="strip strip-ink anim-slide" role="status" style={{ marginTop: 16 }}>
        <div className="t-display" style={{ fontSize: 34 }}>Already cleared</div>
        <p style={{ margin: "10px 0 0" }}>You&apos;ve been here. Your current clue ↓</p>
      </div>
    );
  if (banner === "ANOTHER_PHONE")
    return (
      <div className="strip strip-ok anim-slide" role="status" style={{ marginTop: 16 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Your team already solved this on another phone. Here&apos;s your clue.</p>
      </div>
    );
  return null;
}
