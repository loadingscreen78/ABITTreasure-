"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Strip } from "@/components/ui/kit";
import { api } from "@/lib/client/api";
import { BRAND } from "@/lib/brand";
import { clockTime, cpLabel, mmss } from "@/lib/game/format";
import { qrSvg } from "@/lib/qr";
import { OrgHeader, OrganiserGate, type Role } from "./OrganiserGate";

function useData<T>(query: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    if (!query) return;
    let live = true;
    void api<T>(`/api/print?${query}`).then((r) => live && setState(r.ok ? { data: r as T } : { error: r.message }));
    return () => {
      live = false;
    };
  }, [query]);
  return state;
}

function Qr({ text, mm, label }: { text: string; mm: number; label: string }) {
  const { svg } = qrSvg(text);
  return <span role="img" aria-label={label} style={{ display: "block", width: `${mm}mm`, height: `${mm}mm` }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", `<svg width="100%" height="100%" `) }} />;
}

function Shell({ roles, title, page, children }: { roles: Role[]; title: string; page: string; children: ReactNode }) {
  return (
    <OrganiserGate roles={roles} title={title}>
      {(me) => (
        <div className="dense">
          <style>{page}</style>
          <OrgHeader me={me} here="/print" />
          <div className="no-print sheet-wide" style={{ padding: "14px 20px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h1 className="t-display-sm" style={{ margin: 0 }}>
              {title}
            </h1>
            <button className="btn btn-ink btn-sm" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
            <a className="t-meta" href="/print">
              ← all printables
            </a>
          </div>
          <div className="print-root">{children}</div>
        </div>
      )}
    </OrganiserGate>
  );
}

const PRINT_BASE = `
  @media print { .print-root { margin: 0 } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  .print-root { display: grid; justify-content: center; gap: 12mm; padding: 10mm 0; }
  .p-sheet { background: #fff; color: #121212; box-shadow: 4px 4px 0 0 #121212; border: 1px solid #121212; position: relative; overflow: hidden; }
  @media print { .p-sheet { box-shadow: none; border: 0; break-after: page; } .p-sheet:last-child { break-after: auto; } .print-root { display: block; padding: 0; } }
  .cut { position: absolute; background: #121212; }
`;

// ---------- 1. checkpoint QR cards: A4 landscape, two A5 cards with cut marks ----------
export function PrintCheckpoints() {
  return (
    <Shell roles={["admin"]} title="Checkpoint QR cards" page={`${PRINT_BASE} @page { size: A4 landscape; margin: 0 } .p-sheet { width: 297mm; height: 210mm; display: grid; grid-template-columns: 1fr 1fr; }`}>
      <PrintCheckpointsBody />
    </Shell>
  );
}

// Hooks live in the body so nothing is fetched until the organiser gate has passed.
function PrintCheckpointsBody() {
  const { data, error } = useData<{ base: string; cards: { code: string; order: number; url: string }[] }>("kind=checkpoints");
  const cards = data?.cards ?? [];
  const pairs: (typeof cards)[] = [];
  for (let i = 0; i < cards.length; i += 2) pairs.push(cards.slice(i, i + 2));
  return (
    <>
      {error && <Strip tone="error">{error}</Strip>}
      {data?.base.includes("localhost") && (
        <div className="no-print">
          <Strip tone="error">PUBLIC_BASE_URL is {data.base} — set it to the deployed URL before printing.</Strip>
        </div>
      )}
      {pairs.map((pair, i) => (
        <section className="p-sheet" key={i}>
          {pair.map((c) => (
            <article key={c.code} style={{ padding: "11mm 12mm", display: "flex", flexDirection: "column", borderRight: "0.3mm dashed #121212" }}>
              <div className="t-meta" style={{ fontSize: "8.5pt", borderBottom: "0.6mm solid #121212", paddingBottom: "2mm" }}>
                ABIT · Department of Computer Science · CODE2CAREER
              </div>
              <div className="t-numeral" style={{ fontSize: "62pt", marginTop: "5mm" }}>
                {cpLabel(c.order)}
              </div>
              <div className="t-display-sm" style={{ fontSize: "17pt", marginTop: "2mm" }}>
                Tech Treasure Hunt
              </div>
              <div style={{ margin: "6mm auto 0", padding: "3mm", border: "0.4mm solid #121212" }}>
                <Qr text={c.url} mm={70} label={`QR code for ${c.code}`} />
              </div>
              <p style={{ margin: "4mm 0 0", textAlign: "center", fontWeight: 600, fontSize: "13pt" }}>Scan to reveal the next clue</p>
              <p style={{ margin: "1mm 0 0", textAlign: "center", fontSize: "10.5pt" }}>Log in with your Team ID</p>
              <p className="t-mono" style={{ margin: "2mm 0 0", textAlign: "center", fontSize: "9pt" }}>
                {c.url.replace(/^https?:\/\//, "")}
              </p>
              <div className="t-meta" style={{ marginTop: "auto", fontSize: "7.5pt", borderTop: "0.3mm solid #121212", paddingTop: "2mm" }}>
                Do not remove or move this card · {BRAND.instituteFull}
              </div>
            </article>
          ))}
          <CutMarks />
        </section>
      ))}
    </>
  );
}

function CutMarks() {
  const m = (style: React.CSSProperties) => <span className="cut" style={style} aria-hidden />;
  return (
    <>
      {m({ left: "148.5mm", top: 0, width: "0.3mm", height: "5mm" })}
      {m({ left: "148.5mm", bottom: 0, width: "0.3mm", height: "5mm" })}
    </>
  );
}

// ---------- 2. volunteer secret-word QR (plain text, not a URL) ----------
export function PrintSecretWord() {
  return (
    <Shell roles={["admin"]} title="Volunteer secret-word QR" page={`${PRINT_BASE} @page { size: A5 portrait; margin: 0 } .p-sheet { width: 148mm; height: 210mm; }`}>
      <PrintSecretWordBody />
    </Shell>
  );
}

// Hooks live in the body so nothing is fetched until the organiser gate has passed.
function PrintSecretWordBody() {
  const { data, error } = useData<{ text: string }>("kind=secret-word");
  return (
    <>
      {error && <Strip tone="error">{error}</Strip>}
      {data && (
        <section className="p-sheet" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8mm" }}>
          <div className="t-meta" style={{ fontSize: "8pt" }}>
            ABIT · CODE2CAREER · Tech Treasure Hunt
          </div>
          <div style={{ padding: "3mm", border: "0.4mm solid #121212" }}>
            <Qr text={data.text} mm={90} label="Secret word QR" />
          </div>
          <p className="t-display-sm" style={{ fontSize: "16pt", textAlign: "center", margin: 0 }}>
            Scan to reveal the secret word
          </p>
          <div className="t-meta" style={{ fontSize: "7pt" }}>
            {BRAND.instituteFull}
          </div>
        </section>
      )}
      <p className="no-print t-meta" style={{ textAlign: "center" }}>
        Payload is plain text and changes automatically when the admin changes the secret word. Reprint after any change.
      </p>
    </>
  );
}

// ---------- 3. credential slips: 10 per A4 ----------
export function PrintCredentials() {
  return (
    <Shell roles={["admin"]} title="Team credential slips" page={`${PRINT_BASE} @page { size: A4 portrait; margin: 0 } .p-sheet { width: 210mm; height: 297mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(5, 1fr); }`}>
      <PrintCredentialsBody />
    </Shell>
  );
}

// Hooks live in the body so nothing is fetched until the organiser gate has passed.
function PrintCredentialsBody() {
  const { data, error } = useData<{ teams: { id: string; name: string; members: string[]; rehearsal: boolean; password: string | null }[] }>("kind=credentials");
  const teams = data?.teams.filter((t) => !t.rehearsal) ?? [];
  const pages: (typeof teams)[] = [];
  for (let i = 0; i < teams.length; i += 10) pages.push(teams.slice(i, i + 10));
  return (
    <>
      {error && <Strip tone="error">{error}</Strip>}
      {pages.map((p, i) => (
        <section className="p-sheet" key={i}>
          {p.map((t) => (
            <article key={t.id} style={{ padding: "5mm 6mm", border: "0.2mm dashed #121212", display: "flex", flexDirection: "column", gap: "1.5mm" }}>
              <div className="t-meta" style={{ fontSize: "6.5pt", borderBottom: "0.4mm solid #121212", paddingBottom: "1mm" }}>
                ABIT · CODE2CAREER · Tech Treasure Hunt
              </div>
              <div style={{ fontWeight: 600, fontSize: "11pt" }}>{t.name}</div>
              <div style={{ display: "flex", gap: "6mm", alignItems: "baseline" }}>
                <span className="t-meta" style={{ fontSize: "7pt" }}>Team ID</span>
                <span className="t-mono" style={{ fontSize: "18pt", fontWeight: 600 }}>{t.id}</span>
                <span className="t-meta" style={{ fontSize: "7pt" }}>Password</span>
                <span className="t-mono" style={{ fontSize: "18pt", fontWeight: 600 }}>{t.password ?? "RESET"}</span>
              </div>
              <div style={{ fontSize: "8.5pt", fontWeight: 600 }}>Start at the Registration desk QR.</div>
              <ul style={{ margin: 0, paddingLeft: "4mm", fontSize: "7.5pt" }}>
                <li>Stay together as a team of 3–4.</li>
                <li>Follow the clue sequence; don&apos;t share clues or answers.</li>
                <li>Report to the finish desk after the final clue.</li>
              </ul>
            </article>
          ))}
        </section>
      ))}
      {data && teams.length === 0 && <Strip tone="note">No teams yet. Create or import teams first.</Strip>}
    </>
  );
}

// ---------- 4. answer key (confidential) ----------
interface Key {
  rows: { clue: number; kind: string; title: string; answer: string; cp: string; where: string; hints?: string[]; wallet?: number }[];
  route: { code: string; order: number; location: string; venueDetail: string | null; riddle: string | null; nudge: string | null }[];
  tieBreakers: { q: string; a: string }[];
}
export function PrintAnswerKey() {
  return (
    <Shell roles={["admin", "judge"]} title="Answer key" page={`${PRINT_BASE} @page { size: A4 portrait; margin: 12mm } .p-sheet { width: 186mm; min-height: 273mm; padding: 0; }`}>
      <PrintAnswerKeyBody />
    </Shell>
  );
}

// Hooks live in the body so nothing is fetched until the organiser gate has passed.
function PrintAnswerKeyBody() {
  const { data, error } = useData<Key>("kind=answer-key");
  return (
    <>
      {error && <Strip tone="error">{error}</Strip>}
      {data && (
        <section className="p-sheet" style={{ padding: "8mm" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
            <span className="t-display" style={{ transform: "rotate(-35deg)", fontSize: "40pt", color: "#A4161A", opacity: 0.14, whiteSpace: "nowrap" }}>
              Confidential — organisers only
            </span>
          </div>
          <div className="t-meta" style={{ fontSize: "8pt", borderBottom: "0.6mm solid #121212", paddingBottom: "2mm" }}>
            {BRAND.instituteFull} · CODE2CAREER · Tech Treasure Hunt · CONFIDENTIAL
          </div>
          <h2 className="t-display-sm" style={{ margin: "4mm 0" }}>Answer key</h2>
          <table className="tbl" style={{ background: "transparent" }}>
            <thead>
              <tr>
                <th>Clue</th>
                <th>Type</th>
                <th>Title</th>
                <th>Expected answer</th>
                <th>Asked / credited at</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.clue}>
                  <td>{r.clue}</td>
                  <td>{r.kind}</td>
                  <td>{r.title}</td>
                  <td>
                    <strong>{r.answer}</strong>
                    {!!r.wallet && <div style={{ color: "#55534E" }}>+{r.wallet} hint-wallet pts when solved</div>}
                    {r.hints?.map((h) => (
                      <div key={h} style={{ color: "#55534E" }}>
                        {h}
                      </div>
                    ))}
                  </td>
                  <td>
                    {r.cp} · {r.where}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="t-meta" style={{ margin: "6mm 0 2mm" }}>Route</h3>
          <table className="tbl" style={{ background: "transparent" }}>
            <thead>
              <tr>
                <th>CP</th>
                <th>Location / spot</th>
                <th>Riddle revealed here → next</th>
              </tr>
            </thead>
            <tbody>
              {data.route.map((c) => (
                <tr key={c.code}>
                  <td>{c.code}</td>
                  <td>
                    {c.location}
                    <div style={{ color: "#55534E" }}>{c.venueDetail}</div>
                  </td>
                  <td>
                    {c.riddle ?? "—"}
                    {c.nudge && <div style={{ color: "#55534E" }}>Nudge: {c.nudge}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="t-meta" style={{ margin: "6mm 0 2mm" }}>Tie-breakers (judge only)</h3>
          <ol style={{ margin: 0, paddingLeft: "5mm" }}>
            {data.tieBreakers.map((t) => (
              <li key={t.q}>
                {t.q} — <strong>{t.a}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

// ---------- 5. team answer sheet record (one or all teams) ----------
interface Sheet {
  team: { id: string; name: string; members: string[]; status: string };
  rows: { clue: number; answer: string; marks: number | null }[];
  finalPhrase: string;
  startedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number | null;
  totals: { clues: number; final: number; teamwork: number; timeBonus: number; adjust: number; total: number; rank: number | null } | null;
}
function teamIdFromLocation(): string | null {
  const m = /^\/print\/team\/(T\d{2,3})/.exec(window.location.pathname);
  return m?.[1] ?? new URLSearchParams(window.location.search).get("id");
}
export function PrintTeamSheets() {
  return (
    <Shell roles={["admin", "judge"]} title="Team answer sheets" page={`${PRINT_BASE} @page { size: A4 portrait; margin: 12mm } .p-sheet { width: 186mm; min-height: 270mm; padding: 8mm; box-sizing: border-box; }`}>
      <PrintTeamSheetsBody />
    </Shell>
  );
}

// Hooks live in the body so nothing is fetched until the organiser gate has passed.
function PrintTeamSheetsBody() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const one = teamIdFromLocation();
    if (one) {
      const id = setTimeout(() => setIds([one]), 0);
      return () => clearTimeout(id);
    }
    void api<{ teams: { id: string }[] }>("/api/print?kind=teams").then((r) => (r.ok ? setIds(r.teams.map((t) => t.id)) : setErr(r.message)));
  }, []);
  return (
    <>
      {err && <Strip tone="error">{err}</Strip>}
      {ids?.map((id) => <TeamSheet key={id} id={id} />)}
    </>
  );
}
function TeamSheet({ id }: { id: string }) {
  const { data, error } = useData<Sheet>(`kind=team&id=${encodeURIComponent(id)}`);
  if (error) return <Strip tone="error">{id}: {error}</Strip>;
  if (!data) return <p className="t-meta">Loading {id}…</p>;
  return (
    <section className="p-sheet">
      <div className="t-meta" style={{ fontSize: "8pt", borderBottom: "0.6mm solid #121212", paddingBottom: "2mm" }}>
        {BRAND.instituteFull} · CODE2CAREER · Tech Treasure Hunt · Participant answer sheet
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4mm", margin: "4mm 0" }}>
        <div>
          <div className="t-display-sm">{data.team.name}</div>
          <div>Members: {data.team.members.map((m, i) => `${i + 1}. ${m}`).join("   ")}</div>
        </div>
        <div className="t-mono" style={{ fontSize: "20pt", fontWeight: 600 }}>{data.team.id}</div>
      </div>
      <table className="tbl" style={{ background: "transparent" }}>
        <thead>
          <tr>
            <th style={{ width: "16mm" }}>Clue No.</th>
            <th>Answer</th>
            <th style={{ width: "18mm" }}>Marks</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.clue}>
              <td>{r.clue}</td>
              <td>{r.answer}</td>
              <td>{r.marks ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "3mm", marginTop: "4mm" }} className="t-mono">
        <div>Final secret phrase: <strong>{data.finalPhrase || "—"}</strong></div>
        <div>Start: {clockTime(data.startedAt)}</div>
        <div>Finish: {clockTime(data.finishedAt)} ({mmss(data.elapsedMs)})</div>
        <div>
          Total: <strong>{data.totals?.total ?? "—"}</strong> / 100
        </div>
      </div>
      {data.totals && (
        <p className="t-meta" style={{ marginTop: "3mm" }}>
          Clues {data.totals.clues}/75 · Final {data.totals.final}/15 · Teamwork {data.totals.teamwork}/5 · Time bonus {data.totals.timeBonus}/5
          {data.totals.adjust ? ` · Adjustments ${data.totals.adjust > 0 ? "+" : ""}${data.totals.adjust}` : ""} · Rank {data.totals.rank ?? "—"}
        </p>
      )}
    </section>
  );
}

// ---------- 6. judge evaluation sheet ----------
export function PrintJudgeSheet() {
  return (
    <Shell roles={["admin", "judge"]} title="Judge's evaluation sheet" page={`${PRINT_BASE} @page { size: A4 landscape; margin: 12mm } .p-sheet { width: 273mm; padding: 6mm; box-sizing: border-box; }`}>
      <PrintJudgeSheetBody />
    </Shell>
  );
}

// Hooks live in the body so nothing is fetched until the organiser gate has passed.
function PrintJudgeSheetBody() {
  const { data, error } = useData<{ rows: { id: string; name: string; status: string; clues: number; final: number; teamworkMarks: number; timeBonus: number; adjustMarks: number; total: number; rank: number | null }[] }>("kind=judge-sheet");
  return (
    <>
      {error && <Strip tone="error">{error}</Strip>}
      {data && (
        <section className="p-sheet">
          <div className="t-meta" style={{ fontSize: "8pt", borderBottom: "0.6mm solid #121212", paddingBottom: "2mm" }}>
            {BRAND.instituteFull} · CODE2CAREER · Tech Treasure Hunt · Judge&apos;s team evaluation sheet
          </div>
          <table className="tbl" style={{ background: "transparent", marginTop: "4mm" }}>
            <thead>
              <tr>
                <th>Team ID</th>
                <th>Team Name</th>
                <th>Clues /75</th>
                <th>Final /15</th>
                <th>Teamwork /5</th>
                <th>Time Bonus /5</th>
                <th>Adj.</th>
                <th>Total /100</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.clues}</td>
                  <td>{r.final}</td>
                  <td>{r.teamworkMarks}</td>
                  <td>{r.timeBonus}</td>
                  <td>{r.adjustMarks || ""}</td>
                  <td>
                    <strong>{r.total}</strong>
                  </td>
                  <td>{r.rank ?? (r.status === "DISQUALIFIED" ? "DQ" : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: "10mm" }}>Judge&apos;s Name: ______________________________ &nbsp;&nbsp; Signature: ______________________________</p>
        </section>
      )}
    </>
  );
}

export function PrintIndex() {
  const items: [string, string, string][] = [
    ["/print/checkpoints", "Checkpoint QR cards", "8 A5 cards, 2 per A4, cut marks. No locations, no answers."],
    ["/print/secret-word", "Volunteer secret-word QR", "Plain-text QR for CP-06. Reprint after changing the word."],
    ["/print/credentials", "Team credential slips", "10 per A4 with Team ID + password."],
    ["/print/answer-key", "Answer key", "Confidential — admin / judge only."],
    ["/print/team", "Team answer sheets", "One A4 record per team (mirrors the paper sheet)."],
    ["/print/judge-sheet", "Judge's evaluation sheet", "Clues /75 · Final /15 · Teamwork /5 · Bonus /5 · Total /100."],
  ];
  return (
    <OrganiserGate roles={["admin", "judge"]} title="Printables">
      {(me) => (
        <div className="dense">
          <OrgHeader me={me} here="/print" />
          <div className="sheet-wide" style={{ paddingTop: 18, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {items.map(([href, t, d]) => (
              <a key={href} href={href} className="panel" style={{ textDecoration: "none", display: "block" }}>
                <div className="t-display-sm" style={{ fontSize: 20 }}>{t}</div>
                <p style={{ margin: "6px 0 0" }}>{d}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </OrganiserGate>
  );
}
