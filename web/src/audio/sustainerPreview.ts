import { pluckString } from "./chorusPreview";

export interface SustainerPreviewConfig {
  bpm: number;
  attack: number;
  release: number;
  sustain: number;
  /** Raw 0–40 (−20…+20 dB). */
  lowGain: number;
  /** Raw 0–40 (−20…+20 dB). */
  hiGain: number;
  /** 0–100; 50 keeps the same loudness. */
  level: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(100, v)) / 100;

/** Compressor settings: Sustain lowers the threshold and raises the ratio, Attack lets the pick through, Release holds the gain longer. */
export function sustainerSettings(
  attack: number,
  release: number,
  sustain: number,
): { attackSec: number; releaseSec: number; thresholdDb: number; ratio: number; makeupDb: number } {
  const s = clamp01(sustain);
  const thresholdDb = -10 - s * 40;
  const ratio = 2 + s * 18;
  return {
    attackSec: 0.001 + clamp01(attack) * 0.05,
    releaseSec: 0.05 + clamp01(release) * 0.95,
    thresholdDb,
    ratio,
    makeupDb: Math.min(30, -thresholdDb * (1 - 1 / ratio) * 0.6),
  };
}

/** Raw 0–40 → −20…+20 dB. */
export function shelfDb(raw: number): number {
  return Math.max(0, Math.min(40, raw)) - 20;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** E minor pentatonic phrase, one note every two beats. */
const PHRASE = [64, 67, 69, 71, 74, 71, 69, 67];
const NOTE_LEN_SEC = 4;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const PARAM_GLIDE_SEC = 0.03;

/** Browser-only single guitar notes through a compressor-style sustainer built from the editor's settings. */
export class SustainerPreviewEngine {
  private cfg: SustainerPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private notes: AudioBuffer[] = [];
  private nodes: {
    master: GainNode;
    input: GainNode;
    compressor: DynamicsCompressorNode;
    makeup: GainNode;
    low: BiquadFilterNode;
    high: BiquadFilterNode;
    level: GainNode;
  } | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private lastNote: GainNode | null = null;

  constructor(cfg: SustainerPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: SustainerPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.notes.length === 0) {
      const sr = ctx.sampleRate;
      this.notes = PHRASE.map((m) => {
        const buf = ctx.createBuffer(1, Math.round(sr * NOTE_LEN_SEC), sr);
        pluckString(buf.getChannelData(0), sr, midiHz(m), 0, 0.5);
        return buf;
      });
    }
    this.buildGraph(ctx);
    this.nextNoteTime = ctx.currentTime + 0.05;
    this.noteIndex = 0;
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
    this.lastNote = null;
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
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.knee.value = 6;
    const makeup = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 200;
    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 3000;
    const level = ctx.createGain();
    input.connect(compressor).connect(makeup).connect(low).connect(high).connect(level).connect(master);
    this.nodes = { master, input, compressor, makeup, low, high, level };
    this.applySettings();
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const s = sustainerSettings(this.cfg.attack, this.cfg.release, this.cfg.sustain);
    n.compressor.threshold.setTargetAtTime(s.thresholdDb, t, 0.01);
    n.compressor.ratio.setTargetAtTime(s.ratio, t, 0.01);
    n.compressor.attack.setTargetAtTime(s.attackSec, t, 0.01);
    n.compressor.release.setTargetAtTime(s.releaseSec, t, 0.01);
    n.makeup.gain.setTargetAtTime(10 ** (s.makeupDb / 20), t, PARAM_GLIDE_SEC);
    n.low.gain.setTargetAtTime(shelfDb(this.cfg.lowGain), t, PARAM_GLIDE_SEC);
    n.high.gain.setTargetAtTime(shelfDb(this.cfg.hiGain), t, PARAM_GLIDE_SEC);
    n.level.gain.setTargetAtTime(Math.max(0, Math.min(100, this.cfg.level)) / 50, t, PARAM_GLIDE_SEC);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const noteSec = (60 / Math.max(20, this.cfg.bpm)) * 2;
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextNoteTime;
      const src = ctx.createBufferSource();
      src.buffer = this.notes[this.noteIndex % this.notes.length]!;
      const g = ctx.createGain();
      src.connect(g).connect(this.nodes.input);
      this.lastNote?.gain.setTargetAtTime(0, t, 0.03);
      this.lastNote = g;
      src.start(t);
      src.stop(t + NOTE_LEN_SEC);
      this.noteIndex++;
      this.nextNoteTime += noteSec;
    }
  }
}
