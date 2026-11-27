/** Static SVG art for the home page (server-rendered; motion via CSS / native SVG animation). */

export function Seal() {
  const ring = "CODE2CAREER • INAUGURAL EDITION • EST. 2026 • ABIT CUTTACK • ";
  return (
    <div className="seal" aria-hidden>
      <svg viewBox="0 0 200 200" className="seal-ring">
        <defs>
          <path id="seal-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <circle cx="100" cy="100" r="96" fill="#FBF8F2" stroke="#121212" strokeWidth="2" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="#121212" strokeWidth="1.5" strokeDasharray="3 4" />
        <text fontFamily="var(--font-mono)" fontSize="12.5" fontWeight="600" fill="#121212">
          <textPath href="#seal-circle" textLength="482" lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
      </svg>
      {/* official ABIT logo, static in the centre while the ring turns */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/abit-logo.webp" alt="" width="120" height="120" style={{ position: "absolute", left: "19%", top: "19%", width: "62%", height: "62%" }} />
    </div>
  );
}

// Abstract loop — decorative positions only; real locations stay classified.
const PINS: [number, number][] = [
  [52, 168],
  [104, 70],
  [196, 44],
  [292, 78],
  [330, 160],
  [250, 204],
  [164, 142],
  [78, 214],
];
const PATH = "M" + [...PINS, PINS[0]!].map(([x, y]) => `${x} ${y}`).join(" L");
// courier reaches pin i at exactly i × 1.2 s, in step with the ping rings
const LOOP = [...PINS, PINS[0]!].map(([x, y]) => `${x},${y}`).join(";");
const KEYS = Array.from({ length: PINS.length + 1 }, (_, i) => (i / PINS.length).toFixed(4)).join(";");

export function RouteMap() {
  return (
    <svg viewBox="0 0 380 250" width="100%" role="img" aria-label="A route of eight numbered checkpoints that loops back to the registration desk" style={{ display: "block" }}>
      {/* contour scribbles */}
      <g fill="none" stroke="#121212" strokeOpacity=".08" strokeWidth="1">
        <path d="M10 40 C 80 10, 140 60, 220 30 S 340 20, 372 60" />
        <path d="M10 120 C 70 90, 160 150, 240 110 S 330 100, 372 140" />
        <path d="M10 236 C 90 200, 170 246, 250 226 S 340 210, 372 236" />
      </g>
      <path d={PATH} fill="none" stroke="#121212" strokeWidth="2" strokeDasharray="6 6" />
      {PINS.map(([x, y], i) => (
        <g key={i}>
          {/* ping ring when the courier passes */}
          <g className="motion-only" transform={`translate(${x} ${y})`}>
            <rect x="-12" y="-12" width="24" height="24" fill="none" stroke="#FF5A1F" strokeWidth="2" opacity="0">
              <animate attributeName="opacity" values="0;0.95;0;0" keyTimes="0;0.02;0.12;1" dur="9.6s" begin={`${2.4 + i * 1.2}s`} repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="scale" values="1;2.1;2.1" keyTimes="0;0.12;1" dur="9.6s" begin={`${2.4 + i * 1.2}s`} repeatCount="indefinite" />
            </rect>
          </g>
          <rect x={x - 12} y={y - 12} width="24" height="24" fill={i === 0 || i === 7 ? "#FF5A1F" : "#121212"} stroke="#121212" strokeWidth="1.5" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fontWeight="600" fill={i === 0 || i === 7 ? "#121212" : "#F2EDE3"}>
            {String(i + 1).padStart(2, "0")}
          </text>
        </g>
      ))}
      {/* courier marker travelling the loop */}
      <g className="motion-only">
        <rect x="-7" y="-7" width="14" height="14" fill="#F2C230" stroke="#121212" strokeWidth="2">
          <animateMotion dur="9.6s" begin="2.4s" repeatCount="indefinite" calcMode="linear" values={LOOP} keyTimes={KEYS} />
        </rect>
      </g>
      <text x="14" y="244" fontSize="9" fontFamily="var(--font-mono)" fill="#55534E" letterSpacing="1.2">
        START + FINISH · REGISTRATION DESK
      </text>
    </svg>
  );
}
