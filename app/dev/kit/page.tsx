import { notFound } from "next/navigation";
import { Footer, Marquee, Wordmark } from "@/components/ui/brand";
import { IconArrow, IconCamera, IconCheck, IconClock, IconCross, IconEye, IconLock, IconPin, RoughFilter } from "@/components/ui/icons";
import { ArrivedChip, CodeBlock, CpNumeral, ErrorLine, PunchCard, QuestionCard, Stamp, Strip } from "@/components/ui/kit";
import { BannerStrip } from "@/components/team/Banner";

// Dev-only component sheet. Uses placeholder text only — never real clues.
export default function Kit() {
  if (process.env.NODE_ENV === "production") notFound();
  const sw = (name: string, v: string, ink = false) => (
    <div key={name} style={{ border: "1.5px solid var(--color-ink)", background: v, color: ink ? "var(--color-paper)" : "var(--color-ink)", padding: 10 }} className="t-meta">
      {name}
      <br />
      {v}
    </div>
  );
  return (
    <main className="sheet" style={{ paddingTop: 20, display: "grid", gap: 22 }}>
      <RoughFilter />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Wordmark />
        <span className="t-meta">/dev/kit · Field Dossier</span>
      </div>
      <hr className="rule-2" />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {sw("paper", "#F2EDE3")}
        {sw("card", "#FBF8F2")}
        {sw("ink", "#121212", true)}
        {sw("graphite", "#55534E", true)}
        {sw("signal", "#FF5A1F")}
        {sw("signal-text", "#B23A0E", true)}
        {sw("verified", "#0E6B4C", true)}
        {sw("error", "#A4161A", true)}
        {sw("tape", "#F2C230")}
      </section>
      <CpNumeral order={4} />
      <h1 className="t-display">Display title</h1>
      <p className="t-riddle">&ldquo;Placeholder riddle in IBM Plex Serif italic for the evidence slip.&rdquo;</p>
      <p className="t-meta">Meta label · mono 11px caps</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <IconArrow /> <IconCheck /> <IconCross /> <IconLock /> <IconPin /> <IconEye /> <IconCamera /> <IconClock />
      </div>
      {[0, 3, 8].map((c) => (
        <PunchCard key={c} cleared={c} current={c + 1} />
      ))}
      <ArrivedChip label="Placeholder place" marks={5} />
      <QuestionCard clue={99} title="Sample question">
        <p style={{ margin: "0 0 10px" }}>Placeholder prompt text.</p>
        <CodeBlock code={"console.log(placeholder);\nreturn 42;"} />
      </QuestionCard>
      <div>
        <label className="t-meta field-label" htmlFor="kit-in">
          Your answer
        </label>
        <input id="kit-in" className="input-line" placeholder="type here" />
      </div>
      <button className="btn btn-ink">
        Submit answer <IconArrow />
      </button>
      <button className="btn btn-paper">
        Secondary <IconArrow />
      </button>
      <button className="btn btn-ink" disabled>
        Disabled <IconArrow />
      </button>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <Stamp>Verified</Stamp>
        <Stamp tone="error">Void</Stamp>
      </div>
      <Strip tone="error">
        <ErrorLine>INCORRECT — 2 attempts left for full marks.</ErrorLine>
      </Strip>
      <Strip tone="ok">Saved.</Strip>
      <Strip tone="note">Neutral note strip.</Strip>
      <BannerStrip banner="WRONG_TURN" />
      <BannerStrip banner="ALREADY_CLEARED" />
      <BannerStrip banner="ANOTHER_PHONE" />
      <span className="tape t-meta">Tape strip</span>
      <div className="perf" />
      <Marquee />
      <Footer />
    </main>
  );
}
