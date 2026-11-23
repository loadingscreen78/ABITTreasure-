#!/usr/bin/env node
// Field Dossier guard (Section 10 BANNED list). Fails CI on anything that makes the UI look generic.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "components", "lib"];
const EXT = new Set([".ts", ".tsx", ".css", ".mjs", ".js"]);
const problems = [];

function walk(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) return walk(p);
    return EXT.has(extname(p)) ? [p] : [];
  });
}

function hexToHsl(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join("");
  h = h.slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return { h: hue, s, l };
}

const RULES = [
  { re: /\b(?:purple|violet|indigo|fuchsia|pink|lavender|magenta)\b/i, msg: "banned hue name" },
  { re: /\bbg-(?:gradient|linear|radial|conic)\b/, msg: "gradient utility" },
  { re: /\b(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\(/, msg: "CSS gradient" },
  { re: /\bbackdrop-(?:blur|filter)\b|backdrop-filter\s*:/, msg: "glassmorphism / backdrop blur" },
  { re: /\brounded-(?:lg|xl|2xl|3xl|full)\b/, msg: "soft rounded corners" },
  { re: /\bshadow-(?:sm|md|lg|xl|2xl)\b/, msg: "soft drop shadow utility" },
  { re: /\bdrop-shadow\b|text-shadow\s*:/, msg: "glow / drop shadow" },
  { re: /\b(?:Inter|Poppins|Space[ _]Grotesk)\b/, msg: "banned font" },
  { re: /\b(?:Unleash|Embark on a journey|Welcome to the future|Powered by AI)\b/i, msg: "generic AI copy" },
];

for (const file of ROOTS.flatMap(walk)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    for (const r of RULES) if (r.re.test(line)) problems.push(`${where}  ${r.msg}: ${line.trim().slice(0, 100)}`);
    for (const m of line.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      const { h, s } = hexToHsl(m[0]);
      if (h >= 240 && h <= 330 && s > 0.15) problems.push(`${where}  banned hue ${m[0]} (h=${h.toFixed(0)} s=${(s * 100).toFixed(0)}%)`);
    }
    // box-shadow blur must be 0 (hard offset shadows only)
    for (const m of line.matchAll(/box-shadow\s*:\s*([^;]+)/g)) {
      for (const part of m[1].split(/,(?![^(]*\))/)) {
        const nums = part.trim().split(/\s+/).filter((x) => /^-?\d/.test(x));
        if (nums.length >= 3 && parseFloat(nums[2]) !== 0) problems.push(`${where}  blurred box-shadow: ${part.trim()}`);
      }
    }
    for (const m of line.matchAll(/border-radius\s*:\s*([\d.]+)(px|rem|em|%)/g)) {
      const v = parseFloat(m[1]);
      const px = m[2] === "px" ? v : m[2] === "%" ? 999 : v * 16;
      if (px > 2) problems.push(`${where}  border-radius > 2px: ${m[0]}`);
    }
    if (file.endsWith(".tsx") && /\p{Extended_Pictographic}/u.test(line)) problems.push(`${where}  emoji in JSX`);
  });
}

if (problems.length) {
  console.error(`check-design: ${problems.length} problem(s)\n` + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log("check-design: OK — no banned colours, gradients, blur, soft corners, fonts or emoji.");
