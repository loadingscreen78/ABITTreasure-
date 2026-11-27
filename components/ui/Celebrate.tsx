"use client";
import { useEffect, useRef } from "react";

/**
 * Lightweight celebration canvas (no library): paper confetti, fireworks and rising embers in the
 * brand palette. One canvas, capped particle counts and devicePixelRatio, stops itself when done.
 * Renders nothing for prefers-reduced-motion. pointer-events: none — never blocks buttons.
 */
export type CelebrateKind = "confetti" | "fireworks" | "embers";

const COLORS = ["#FF5A1F", "#F2C230", "#F2EDE3", "#0E6B4C", "#B23A0E", "#FF5A1F", "#F2C230"];

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  kind: "chad" | "spark" | "rocket" | "ember";
  g?: number;
  burst?: number;
  trail?: [number, number][];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

export function Celebrate({
  kind,
  delay = 0,
  duration = 3800,
  originX = 0.5,
  originY = 0.5,
  pad = 0,
  padTop = 0,
}: {
  kind: CelebrateKind;
  delay?: number;
  duration?: number;
  /** For embers: emit point as fractions of the canvas (0..1). */
  originX?: number;
  originY?: number;
  /** Let the canvas extend beyond its positioned parent (px). */
  pad?: number;
  padTop?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const small = W < 600;
    const ps: P[] = [];
    let raf = 0;
    let last = 0;
    let started = 0;
    let stopped = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const chad = (x: number, y: number, vx: number, vy: number, g = 900, max = rand(2.4, 3.6)) =>
      ps.push({ x, y, vx, vy, life: 0, max, size: rand(5, 10), color: pick(COLORS), rot: rand(0, Math.PI), vr: rand(-12, 12), kind: "chad", g });

    const cannons = () => {
      const n = small ? 70 : 110;
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        const ang = (left ? rand(-78, -52) : rand(-128, -102)) * (Math.PI / 180);
        const sp = rand(small ? 620 : 820, small ? 980 : 1300);
        chad(left ? -6 : W + 6, H * 0.92, Math.cos(ang) * sp, Math.sin(ang) * sp);
      }
    };
    const rain = () => {
      const n = small ? 60 : 100;
      // floaty paper rain: low gravity, long life
      for (let i = 0; i < n; i++) chad(rand(0, W), rand(-H * 0.5, -10), rand(-40, 40), rand(30, 90), 150, rand(3.8, 5.4));
    };
    const rocket = () => {
      const x = rand(W * 0.15, W * 0.85);
      ps.push({ x, y: H + 4, vx: rand(-40, 40), vy: -rand(H * 1.05, H * 1.35), life: 0, max: rand(0.75, 1.0), size: 3, color: "#F2EDE3", rot: 0, vr: 0, kind: "rocket", burst: rand(0.62, 0.85), trail: [] });
    };
    const explode = (x: number, y: number) => {
      const n = small ? 46 : 70;
      const c1 = pick(COLORS);
      const c2 = pick(COLORS);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
        const sp = rand(small ? 140 : 180, small ? 300 : 380);
        ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(0.9, 1.5), size: rand(2, 3.6), color: i % 3 ? c1 : c2, rot: 0, vr: 0, kind: "spark", trail: [] });
      }
    };
    const embers = () => {
      const o = { x: originX, y: originY };
      const n = small ? 4 : 6;
      for (let i = 0; i < n; i++)
        ps.push({ x: W * o.x + rand(-14, 14), y: H * o.y + rand(-6, 6), vx: rand(-30, 30), vy: -rand(60, 150), life: 0, max: rand(1.2, 2.2), size: rand(1.6, 3.2), color: pick(["#F2C230", "#FF5A1F", "#F2EDE3"]), rot: 0, vr: 0, kind: "ember" });
    };

    const step = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.033, (now - (last || now)) / 1000);
      last = now;
      if (kind === "embers" && now - started < duration) embers();
      ctx.clearRect(0, 0, W, H);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!;
        p.life += dt;
        if (p.kind === "chad") {
          p.vy += (p.g ?? 900) * dt;
          p.vx *= 1 - 1.6 * dt;
          p.vy *= 1 - 1.1 * dt;
          p.vx += Math.sin(p.life * 6 + p.size) * 30 * dt;
          p.rot += p.vr * dt;
        } else if (p.kind === "rocket") {
          p.vy += 260 * dt;
          p.trail!.push([p.x, p.y]);
          if (p.trail!.length > 8) p.trail!.shift();
          if (p.life >= p.burst!) {
            explode(p.x, p.y);
            ps.splice(i, 1);
            continue;
          }
        } else if (p.kind === "spark") {
          p.vy += 160 * dt;
          p.vx *= 1 - 1.4 * dt;
          p.vy *= 1 - 1.4 * dt;
          p.trail!.push([p.x, p.y]);
          if (p.trail!.length > 5) p.trail!.shift();
        } else {
          p.vy *= 1 - 0.6 * dt;
          p.vx += Math.sin(p.life * 5) * 20 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life >= p.max || p.y > H + 40) {
          ps.splice(i, 1);
          continue;
        }
        const fade = Math.max(0, 1 - Math.pow(p.life / p.max, 2.2));
        ctx.globalAlpha = fade;
        if (p.kind === "chad") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.life * 9 + p.size));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else if (p.kind === "rocket" || p.kind === "spark") {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.7;
          ctx.beginPath();
          const tr = p.trail!;
          if (tr.length) {
            ctx.moveTo(tr[0]![0], tr[0]![1]);
            for (const [tx, ty] of tr) ctx.lineTo(tx, ty);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      }
      ctx.globalAlpha = 1;
      if (ps.length || now - started < duration) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, W, H);
    };

    const begin = () => {
      started = performance.now();
      if (kind === "confetti") {
        cannons();
        timers.push(setTimeout(rain, 650));
      } else if (kind === "fireworks") {
        const shots = small ? 8 : 12;
        for (let k = 0; k < shots; k++) timers.push(setTimeout(rocket, k * 460 + rand(0, 180)));
        timers.push(setTimeout(rain, 300));
      }
      raf = requestAnimationFrame(step);
    };
    timers.push(setTimeout(begin, delay));
    window.addEventListener("resize", resize);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", resize);
    };
  }, [kind, delay, duration, originX, originY]);

  return <canvas ref={ref} aria-hidden style={{ position: "absolute", left: -pad, top: -padTop, width: `calc(100% + ${pad * 2}px)`, height: `calc(100% + ${padTop}px)`, pointerEvents: "none", zIndex: 2 }} />;
}
