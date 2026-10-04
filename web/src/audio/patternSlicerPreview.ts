import { stepDurationSec } from "./stepPreview";

export interface PatternSlicerPreviewConfig {
  bpm: number;
  rateIndex: number;
  /** 0–19 (P01–P20). */
  pattern: number;
  /** 1–99: share of each slice that sounds. */
  duty: number;
  /** 0–100: soft fade-in → hard, accented start. */
  attack: number;
  /** 0–100: how far the gaps drop (100 = silence). */
  depth: number;
  compThresholdDb: number;
  compGainDb: number;
}

export interface SliceEnvelope {
  onSec: number;
  rampSec: number;
  peak: number;
  floor: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(100, v)) / 100;

/** Gate shape of one slice: sounding time (Duty), fade-in and accent (Attack), gap level (Depth). */
export function sliceEnvelope(stepSec: number, duty: number, attack: number, depth: number): SliceEnvelope {
  const onSec = stepSec * (Math.max(1, Math.min(99, duty)) / 100);
  const a = clamp01(attack);
  return {
    onSec,
    rampSec: 0.002 + (1 - a) * Math.min(onSec * 0.5, 0.06),
    peak: 1 + a * 0.5,
    floor: 1 - clamp01(depth),
  };
}

/**
 * Preview rhythms for P01–P20, one slice per character: `x` starts a slice, `-` holds the
 * previous one, `.` is a gap. The RC-600's own patterns are not published; these only
 * give each number a distinct rhythm.
 */
export const SLICE_PATTERNS: string[] = [
  "xxxxxxxxxxxxxxxx",
  "x.x.x.x.x.x.x.x.",
  "x-x-x-x-x-x-x-x-",
  "x..x..x.x..x..x.",
  "x-.x-.x.x-.x-.x.",
  "xx.xx.x.xx.xx.x.",
  "x.xx.xx.x.xx.xx.",
  "x---x---x---x---",
  "x.x.xx.xx.x.xx.x",
  "xx.x.xx.xx.x.xx.",
  "x..xx..xx..xx..x",
  "x.xxx.xxx.xxx.xx",
  "x-x.x-x.x-x.x-x.",
  "xxx.xxx.xxx.xx.x",
  "x...x.x.x...x.xx",
  "x-.xx-.xx-.xx-.x",
  "xx..xx..xx..x.x.",
  "x.x..x.x..x.x.x.",
  "x--x--x-x--x--x-",
  "xxxx.xx.xxxx.x.x",
];

/** Slice `index` of the pattern: how many slices it lasts (0 = gap or held). */
export function sliceSpan(pattern: number, index: number): number {
  const p = SLICE_PATTERNS[Math.max(0, Math.min(SLICE_PATTERNS.length - 1, pattern))]!;
  const at = (i: number) => p[i % p.length];
  if (at(index) !== "x") return 0;
  let span = 1;
  while (span < p.length && at(index + span) === "-") span++;
  return span;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** G – Em – C – D pad voicings, one chord per bar. */
const PAD_CHORDS: number[][] = [
  [55, 59, 62, 67],
  [52, 59, 64, 67],
  [48, 55, 60, 64],
  [50, 57, 62, 66],
];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const PARAM_GLIDE_SEC = 0.03;

/** Browser-only sustained pad cut into slices with the editor's Rate, Duty, Attack, Depth and Comp. */
export class PatternSlicerPreviewEngine {
  private cfg: PatternSlicerPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nodes: {
    master: GainNode;
    gate: GainNode;
    compressor: DynamicsCompressorNode;
    makeup: GainNode;
    voices: OscillatorNode[];
  } | null = null;
  private nextSliceTime = 0;
  private sliceIndex = 0;
  private nextBarTime = 0;
  private bar = 0;

  constructor(cfg: PatternSlicerPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: PatternSlicerPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    this.buildGraph(ctx);
    this.nextSliceTime = ctx.currentTime + 0.05;
    this.nextBarTime = this.nextSliceTime;
    this.sliceIndex = 0;
    this.bar = 0;
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
      setTimeout(() => {
        nodes.voices.forEach((v) => v.stop());
        nodes.master.disconnect();
      }, 200);
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

  private buildGraph(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const compressor = ctx.createDynamicsCompressor();
    compressor.ratio.value = 4;
    compressor.knee.value = 12;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;
    const makeup = ctx.createGain();
    const gate = ctx.createGain();
    gate.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2800;
    tone.connect(gate).connect(compressor).connect(makeup).connect(master);
    const voices = PAD_CHORDS[0]!.map((m, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiHz(m);
      osc.detune.value = (i % 2 === 0 ? -1 : 1) * 6;
      const g = ctx.createGain();
      g.gain.value = 0.09;
      osc.connect(g).connect(tone);
      osc.start();
      return osc;
    });
    this.nodes = { master, gate, compressor, makeup, voices };
    this.applySettings();
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    n.compressor.threshold.setTargetAtTime(Math.max(-30, Math.min(0, this.cfg.compThresholdDb)), t, 0.01);
    const gainDb = Math.max(0, Math.min(20, this.cfg.compGainDb));
    n.makeup.gain.setTargetAtTime(10 ** (gainDb / 20), t, PARAM_GLIDE_SEC);
  }

  private schedule(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD_SEC;
    const barSec = (60 / Math.max(20, this.cfg.bpm)) * 4;
    while (this.nextBarTime < horizon) {
      const chord = PAD_CHORDS[this.bar % PAD_CHORDS.length]!;
      n.voices.forEach((v, i) => v.frequency.setValueAtTime(midiHz(chord[i]!), this.nextBarTime));
      this.bar++;
      this.nextBarTime += barSec;
    }
    while (this.nextSliceTime < horizon) {
      const stepSec = Math.max(0.03, stepDurationSec(this.cfg.rateIndex, this.cfg.bpm));
      const span = sliceSpan(this.cfg.pattern, this.sliceIndex);
      if (span > 0) {
        const env = sliceEnvelope(stepSec, this.cfg.duty, this.cfg.attack, this.cfg.depth);
        const t = this.nextSliceTime;
        const g = n.gate.gain;
        g.setValueAtTime(env.floor, t);
        g.linearRampToValueAtTime(env.peak, t + env.rampSec);
        g.setTargetAtTime(1, t + env.rampSec, 0.04);
        g.setTargetAtTime(env.floor, t + (span - 1) * stepSec + env.onSec, 0.004);
      }
      this.sliceIndex = (this.sliceIndex + 1) % 16;
      this.nextSliceTime += stepSec;
    }
  }
}
