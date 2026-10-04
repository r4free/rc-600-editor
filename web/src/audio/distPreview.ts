import { pluckString } from "./chorusPreview";

export interface DistPreviewConfig {
  bpm: number;
  /** TYPE: 0 VOCAL, 1 BOOST, 2 OD, 3 DS, 4 METAL, 5 FUZZ. */
  type: number;
  /** Raw TONE 0–100 (−50…+50). */
  tone: number;
  /** DIST 0–100. */
  dist: number;
  dLevel: number;
  eLevel: number;
}

type Shape = "soft" | "hard" | "fuzz";
/** Per type: input gain range (×) at DIST 0 and 100, clipping shape, and a pre-filter emphasis (Hz). */
export const DIST_TYPES: { name: string; gain: [number, number]; shape: Shape; mid: number }[] = [
  { name: "VOCAL", gain: [1.5, 12], shape: "soft", mid: 1800 },
  { name: "BOOST", gain: [1, 3], shape: "soft", mid: 1000 },
  { name: "OD", gain: [2, 20], shape: "soft", mid: 800 },
  { name: "DS", gain: [5, 60], shape: "hard", mid: 1000 },
  { name: "METAL", gain: [12, 150], shape: "hard", mid: 600 },
  { name: "FUZZ", gain: [8, 90], shape: "fuzz", mid: 400 },
];

/** Input gain for TYPE at DIST 0–100 (log interpolation). */
export function distDrive(type: number, dist: number): number {
  const [lo, hi] = (DIST_TYPES[type] ?? DIST_TYPES[2]!).gain;
  const d = Math.max(0, Math.min(100, dist)) / 100;
  return lo * (hi / lo) ** d;
}

/** One sample of the clipping curve for `shape` (input already gained). */
export function clipSample(x: number, shape: Shape): number {
  if (shape === "hard") return Math.max(-1, Math.min(1, x * 1.2)) * 0.9 + Math.tanh(x) * 0.1;
  if (shape === "fuzz") {
    const y = Math.tanh(x + 0.25) - Math.tanh(0.25);
    return Math.sign(y) * Math.min(1, Math.abs(y) * 1.4);
  }
  return Math.tanh(x);
}

/** TONE −50…+50 → lowpass cutoff (Hz): darker to brighter. */
export function distToneHz(tone: number): number {
  const t = (Math.max(0, Math.min(100, tone)) - 50) / 50;
  return 3500 * 2 ** (t * 1.6);
}

/** Power-chord riff in E (root MIDI per eighth, null = rest). */
const RIFF: (number | null)[] = [40, 40, null, 40, 43, null, 45, null, 40, 40, null, 40, 47, 45, 43, null];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const NOTE_SEC = 0.6;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.03;

function curveFor(shape: Shape): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = clipSample(((i / (n - 1)) * 2 - 1) * 4, shape);
  return c;
}

/** Browser-only distortion: a power-chord riff (or a sung line for VOCAL) through the selected pedal type. */
export class DistPreviewEngine {
  private cfg: DistPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private chords = new Map<number, AudioBuffer>();
  private nodes: {
    master: GainNode;
    input: GainNode;
    dry: GainNode;
    drive: GainNode;
    mid: BiquadFilterNode;
    shaper: WaveShaperNode;
    tone: BiquadFilterNode;
    wet: GainNode;
  } | null = null;
  private shape: Shape | null = null;
  private nextEighth = 0;
  private eighth = 0;

  constructor(cfg: DistPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: DistPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.chords.size === 0) {
      const sr = ctx.sampleRate;
      for (const root of new Set(RIFF.filter((n): n is number => n !== null))) {
        const buf = ctx.createBuffer(1, Math.round(sr * NOTE_SEC), sr);
        const data = buf.getChannelData(0);
        for (const [i, interval] of [0, 7, 12].entries()) pluckString(data, sr, midiHz(root + interval), i * 40, 0.35);
        this.chords.set(root, buf);
      }
    }
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const dry = ctx.createGain();
    input.connect(dry).connect(master);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 90;
    const drive = ctx.createGain();
    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.Q.value = 0.8;
    mid.gain.value = 6;
    const shaper = ctx.createWaveShaper();
    shaper.oversample = "4x";
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.Q.value = 0.7;
    const wet = ctx.createGain();
    input.connect(hp).connect(mid).connect(drive).connect(shaper).connect(tone).connect(wet).connect(master);
    this.nodes = { master, input, dry, drive, mid, shaper, tone, wet };
    this.shape = null;
    this.applySettings();
    this.nextEighth = ctx.currentTime + 0.05;
    this.eighth = 0;
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    const nodes = this.nodes;
    if (ctx && nodes) {
      nodes.master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(() => nodes.master.disconnect(), 200);
    }
    this.nodes = null;
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    return this.ctx;
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const spec = DIST_TYPES[this.cfg.type] ?? DIST_TYPES[2]!;
    if (spec.shape !== this.shape) {
      n.shaper.curve = curveFor(spec.shape);
      this.shape = spec.shape;
    }
    const drive = distDrive(this.cfg.type, this.cfg.dist);
    n.drive.gain.setTargetAtTime(drive / 4, t, GLIDE);
    n.mid.frequency.setTargetAtTime(spec.mid, t, GLIDE);
    n.tone.frequency.setTargetAtTime(distToneHz(this.cfg.tone), t, GLIDE);
    n.dry.gain.setTargetAtTime(Math.max(0, Math.min(100, this.cfg.dLevel)) / 100, t, GLIDE);
    const makeup = spec.shape === "soft" && drive < 4 ? 1 : 0.55;
    n.wet.gain.setTargetAtTime((Math.max(0, Math.min(100, this.cfg.eLevel)) / 50) * makeup, t, GLIDE);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    while (this.nextEighth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextEighth;
      const root = RIFF[this.eighth % RIFF.length];
      if (root != null) {
        if (this.cfg.type === 0) this.sing(t, root + 24, eighthSec * 0.95);
        else this.strum(t, root, Math.min(NOTE_SEC, eighthSec * 0.95));
      }
      this.eighth++;
      this.nextEighth += eighthSec;
    }
  }

  private strum(t: number, root: number, dur: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.chords.get(root)!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.setTargetAtTime(0, t + dur, 0.015);
    src.connect(env).connect(this.nodes!.input);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  private sing(t: number, midi: number, dur: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.02);
    env.gain.setTargetAtTime(0, t + dur * 0.8, 0.03);
    env.connect(this.nodes!.input);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiHz(midi);
    for (const [hz, gain] of [
      [730, 2.4],
      [1090, 1.5],
      [2440, 0.7],
    ] as const) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz;
      bp.Q.value = 7;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(bp).connect(g).connect(env);
    }
    osc.start(t);
    osc.stop(t + dur + 0.2);
  }
}
