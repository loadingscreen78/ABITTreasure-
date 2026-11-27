"use client";

/**
 * Procedural soundtrack for the welcome briefing — generated live with the Web Audio API
 * (no audio files, no licensing, nothing to download). A dark A-minor synth groove that builds
 * with the film, plus sound effects cued exactly on each scene's animation beats.
 */

const PROG: number[][] = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [60, 64, 67], // C
  [55, 59, 62], // G
];
const BASS = [45, 41, 48, 43];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Ctx = AudioContext;

export class Score {
  private ctx: Ctx;
  private master: GainNode;
  private bus: GainNode;
  private noise: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextT = 0;
  private step = 0;
  private level = 0;
  private muted = false;
  private dead = false;
  private readonly eighth = 0.25; // 120 BPM

  static create(): Score | null {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      return new Score(new AC());
    } catch {
      return null;
    }
  }

  private constructor(ctx: Ctx) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(comp);
    comp.connect(this.master);
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Must be called from a user gesture (tap / click). */
  start() {
    if (this.dead) return;
    void this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(0, t);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.55, t + 0.8);
    if (!this.timer) {
      this.nextT = t + 0.06;
      this.timer = setInterval(() => this.tick(), 25);
    }
  }

  setLevel(n: number) {
    this.level = n;
  }

  setMuted(m: boolean) {
    this.muted = m;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(m ? 0 : 0.55, t + 0.25);
  }

  stop(fade = 1.2) {
    if (this.dead) return;
    this.dead = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => {
      if (this.timer) clearInterval(this.timer);
      void this.ctx.close().catch(() => undefined);
    }, fade * 1000 + 200);
  }

  // ---------- sequencer ----------
  private tick() {
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextT < ahead) {
      this.beat(this.step, this.nextT);
      this.nextT += this.eighth;
      this.step++;
    }
  }

  private beat(step: number, t: number) {
    const bar = Math.floor(step / 8) % 4;
    const pos = step % 8;
    const L = this.level;
    const chord = PROG[bar]!;
    if (L >= 1 && pos === 0) this.pad(chord, t, 2.0);
    if (L >= 1 && (pos === 0 || pos === 3 || pos === 4 || pos === 6)) this.bass(BASS[bar]!, t, pos === 0 ? 0.42 : 0.22);
    if (L >= 2 && (pos === 0 || pos === 4)) this.kick(t, 0.9);
    if (L >= 3 && (pos === 2 || pos === 6)) this.kick(t, 0.55);
    if (L >= 2 && pos % 2 === 1) this.hat(t, 0.16);
    if (L >= 3 && (pos === 2 || pos === 6)) this.clap(t, 0.35);
    if (L >= 3) this.pluck(chord[pos % 3]! + (pos >= 4 ? 12 : 0), t, 0.09);
  }

  // ---------- voices ----------
  private env(g: GainNode, t: number, a: number, peak: number, r: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  }

  private pad(notes: number[], t: number, len: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1300, t + len * 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.3);
    f.connect(g);
    g.connect(this.bus);
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + len + 0.4);
      }
    }
  }

  private bass(n: number, t: number, len: number) {
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = hz(n);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + len);
    const g = this.ctx.createGain();
    this.env(g, t, 0.01, 0.32, len);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  private kick(t: number, v: number) {
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, 0.9 * v, 0.32);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.4);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, dur: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.002, peak, dur);
    s.connect(f).connect(g).connect(this.bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  private hat(t: number, v: number) {
    this.noiseHit(t, "highpass", 7000, 0.7, v, 0.05);
  }

  private clap(t: number, v: number) {
    this.noiseHit(t, "bandpass", 1500, 0.9, v, 0.14);
  }

  private pluck(n: number, t: number, v: number) {
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.value = hz(n);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(600, t + 0.16);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, v, 0.17);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.22);
  }

  private blip(t: number, freq: number, v = 0.12, dur = 0.08, type: OscillatorType = "sine") {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, t, 0.003, v, dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- sound effects ----------
  private stamp(t: number) {
    this.kick(t, 1.1);
    this.noiseHit(t, "lowpass", 900, 0.6, 0.5, 0.18);
  }
  private impact(t: number) {
    this.kick(t, 1.2);
    this.noiseHit(t, "bandpass", 400, 0.5, 0.55, 0.45);
    this.blip(t, 55, 0.35, 0.6, "triangle");
  }
  private type(t: number, n: number, gap = 0.055) {
    for (let i = 0; i < n; i++) this.noiseHit(t + i * gap + Math.random() * 0.012, "highpass", 3800, 1.2, 0.18, 0.02);
  }
  private riser(t: number, dur: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(5000, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    s.connect(f).connect(g).connect(this.bus);
    s.start(t);
    s.stop(t + dur + 0.1);
  }
  private chime(t: number, notes: number[]) {
    notes.forEach((n, i) => this.blip(t + i * 0.07, hz(n), 0.1, 0.5, "triangle"));
  }

  /** Scene-synced cues. Offsets match the CSS animation delays in components/home/Intro.tsx. */
  cue(scene: string) {
    if (this.dead) return;
    const t = this.ctx.currentTime + 0.02;
    switch (scene) {
      case "decrypt":
        this.setLevel(1);
        this.type(t + 0.2, 22, 0.075);
        this.stamp(t + 0.55);
        this.riser(t + 1.4, 1.1);
        break;
      case "presents":
        this.setLevel(1);
        this.chime(t, [69, 76, 81]);
        this.type(t + 0.8, 14, 0.06);
        this.blip(t + 1.7, hz(88), 0.08, 0.4, "triangle");
        this.blip(t + 2.1, hz(76), 0.08, 0.3, "triangle");
        break;
      case "title":
        this.setLevel(2);
        this.impact(t + 0.1);
        this.impact(t + 0.48);
        this.impact(t + 0.86);
        this.chime(t + 1.5, [69, 72, 76, 81]);
        break;
      case "mission":
        this.setLevel(2);
        this.type(t + 0.1, 16, 0.05);
        for (let i = 0; i < 8; i++) this.blip(t + 0.82 + i * 0.17, hz(64 + [0, 3, 5, 7, 10, 12, 15, 17][i]!), 0.1, 0.12, "square");
        this.stamp(t + 2.4);
        break;
      case "scan":
        this.setLevel(2);
        for (let i = 0; i < 6; i++) this.blip(t + 0.1 + i * 0.18, 1200 + i * 90, 0.05, 0.05);
        this.blip(t + 1.3, 1760, 0.14, 0.09);
        this.blip(t + 1.42, 2349, 0.14, 0.12);
        break;
      case "solve":
        this.setLevel(3);
        this.type(t + 0.9, 2, 0.07);
        this.stamp(t + 1.5);
        this.chime(t + 1.62, [76, 81, 88]);
        break;
      case "decrypt-riddle":
        this.setLevel(3);
        for (let i = 0; i < 26; i++) this.blip(t + 0.5 + i * 0.05, 300 + Math.random() * 2200, 0.03, 0.03, "square");
        this.chime(t + 1.85, [72, 76, 79, 84]);
        break;
      case "move":
        this.setLevel(3);
        for (let i = 0; i < 8; i++) {
          this.noiseHit(t + 0.5 + i * 0.21, "bandpass", 2200, 1.5, 0.35, 0.04);
          this.blip(t + 0.52 + i * 0.21, hz(45 + i * 2), 0.18, 0.08, "triangle");
        }
        break;
      case "numbers":
        this.setLevel(3);
        for (let i = 0; i < 18; i++) this.noiseHit(t + i * 0.06, "highpass", 5000, 1, 0.12, 0.015);
        this.impact(t + 1.15);
        break;
      case "rules":
        this.setLevel(2);
        for (let i = 0; i < 4; i++) this.stamp(t + 0.15 + i * 0.38);
        this.riser(t + 2.2, 1.1);
        break;
      // ---- inaugural opening ----
      case "welcome":
        this.setLevel(1);
        this.blip(t + 0.1, hz(69), 0.08, 0.6, "triangle");
        this.riser(t + 0.05, 0.4);
        this.impact(t + 0.45);
        this.chime(t + 0.6, [69, 76, 81, 88]);
        break;
      case "series":
        this.setLevel(2);
        for (let k = 0; k < 11; k++) {
          this.noiseHit(t + 0.12 + k * 0.095, "bandpass", 1800, 1.2, 0.22, 0.04);
          this.blip(t + 0.12 + k * 0.095, hz(57 + [0, 3, 7, 12, 15, 12, 7, 3, 7, 12, 19][k]!), 0.07, 0.1, "square");
        }
        this.impact(t + 1.2);
        break;
      case "est":
        this.setLevel(2);
        this.chime(t + 0.15, [64, 69, 72, 76]);
        this.stamp(t + 1.1);
        this.blip(t + 1.12, hz(45), 0.3, 0.5, "triangle");
        break;
      case "lamp":
        this.setLevel(1);
        this.riser(t + 0.1, 0.65);
        this.blip(t + 0.72, hz(81), 0.12, 1.2, "sine");
        this.chime(t + 0.8, [69, 72, 76, 79, 84, 88]);
        this.pad([57, 64, 69, 76], t + 0.8, 3.2);
        break;
      case "event":
        this.setLevel(3);
        this.impact(t + 0.3);
        this.impact(t + 0.68);
        this.impact(t + 1.06);
        this.chime(t + 1.7, [69, 72, 76, 81]);
        break;
      case "open":
        this.setLevel(1);
        this.impact(t + 0.3);
        this.pad([57, 64, 69, 72], t + 0.3, 3.6);
        this.chime(t + 0.5, [69, 72, 76, 81, 84]);
        break;
    }
  }
}
