import { pluckString } from "./chorusPreview";

export interface G2bPreviewConfig {
  bpm: number;
  /** 0–100: direct guitar → bass. */
  balance: number;
  /** 0 = MODE 1 (previous RC series), 1 = MODE 2 (new algorithm). */
  mode: number;
}

/** Equal-power blend of the direct guitar and the bass. */
export function g2bMix(balance: number): { dry: number; wet: number } {
  const b = Math.max(0, Math.min(100, balance)) / 100;
  return { dry: Math.cos((b * Math.PI) / 2), wet: Math.sin((b * Math.PI) / 2) };
}

/** E minor pentatonic guitar riff in eighth notes (null = rest). */
export const G2B_RIFF: (number | null)[] = [
  52, null, 52, 55, 57, null, 55, 52, 59, null, 57, 55, 52, 55, 50, null,
];

/** The bass plays the guitar note one octave lower. */
export const bassMidi = (guitar: number) => guitar - 12;

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const NOTE_SEC = 0.9;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

/**
 * Browser-only Guitar to Bass: a guitar riff with the same line an octave lower as a bass.
 * MODE 2 sounds rounder and tracks tightly; MODE 1 is a buzzier synth bass that lags a little.
 */
export class G2bPreviewEngine {
  private cfg: G2bPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private guitar = new Map<number, AudioBuffer>();
  private bass = new Map<number, AudioBuffer>();
  private nodes: { master: GainNode; dry: GainNode; wet: GainNode } | null = null;
  private nextTime = 0;
  private index = 0;

  constructor(cfg: G2bPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: G2bPreviewConfig): void {
    this.cfg = cfg;
    this.applyMix();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.guitar.size === 0) {
      const sr = ctx.sampleRate;
      for (const m of new Set(G2B_RIFF.filter((n): n is number => n !== null))) {
        const g = ctx.createBuffer(1, Math.round(sr * NOTE_SEC), sr);
        pluckString(g.getChannelData(0), sr, midiHz(m), 0, 0.5);
        this.guitar.set(m, g);
        const b = ctx.createBuffer(1, Math.round(sr * NOTE_SEC), sr);
        pluckString(b.getChannelData(0), sr, midiHz(bassMidi(m)), 0, 0.7);
        this.bass.set(m, b);
      }
    }
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    const dry = ctx.createGain();
    dry.connect(master);
    const wet = ctx.createGain();
    wet.connect(master);
    this.nodes = { master, dry, wet };
    this.applyMix();
    this.nextTime = ctx.currentTime + 0.05;
    this.index = 0;
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

  private applyMix(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const mix = g2bMix(this.cfg.balance);
    n.dry.gain.setTargetAtTime(mix.dry, ctx.currentTime, 0.03);
    n.wet.gain.setTargetAtTime(mix.wet, ctx.currentTime, 0.03);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const stepSec = 30 / Math.max(20, this.cfg.bpm);
      const note = G2B_RIFF[this.index % G2B_RIFF.length];
      if (note != null) this.playNote(this.nextTime, Math.min(NOTE_SEC, stepSec * 1.8), note);
      this.index++;
      this.nextTime += stepSec;
    }
  }

  private playNote(t: number, dur: number, note: number): void {
    const ctx = this.ctx!;
    const n = this.nodes!;
    const guitar = ctx.createBufferSource();
    guitar.buffer = this.guitar.get(note)!;
    const gEnv = ctx.createGain();
    gEnv.gain.setValueAtTime(1, t);
    gEnv.gain.setTargetAtTime(0, t + dur, 0.02);
    guitar.connect(gEnv).connect(n.dry);
    guitar.start(t);
    guitar.stop(t + dur + 0.15);

    const classic = this.cfg.mode === 0;
    const start = t + (classic ? 0.018 : 0.004);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = classic ? 650 : 900;
    tone.Q.value = classic ? 4 : 0.7;
    const bEnv = ctx.createGain();
    bEnv.gain.setValueAtTime(0, start);
    bEnv.gain.linearRampToValueAtTime(1, start + 0.006);
    bEnv.gain.setTargetAtTime(classic ? 0.75 : 0.6, start + 0.006, 0.12);
    bEnv.gain.setTargetAtTime(0, start + dur, 0.03);
    tone.connect(bEnv).connect(n.wet);

    const hz = midiHz(bassMidi(note));
    const osc = ctx.createOscillator();
    osc.type = classic ? "square" : "sine";
    osc.frequency.value = hz;
    const oscGain = ctx.createGain();
    oscGain.gain.value = classic ? 0.22 : 0.35;
    osc.connect(oscGain).connect(tone);
    osc.start(start);
    osc.stop(start + dur + 0.2);
    if (!classic) {
      const body = ctx.createBufferSource();
      body.buffer = this.bass.get(note)!;
      body.connect(tone);
      body.start(start);
      body.stop(start + dur + 0.2);
    }
  }
}
