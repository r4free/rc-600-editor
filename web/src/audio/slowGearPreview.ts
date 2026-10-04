import { pluckString } from "./chorusPreview";

export interface SlowGearPreviewConfig {
  bpm: number;
  /** 0–100: higher = softer picks start a swell. */
  sens: number;
  /** 0–100: time to reach full volume. */
  riseTime: number;
  /** 0–100; 50 keeps the same loudness. */
  level: number;
  /** 0 = MODE 1 (previous RC series), 1 = MODE 2 (new algorithm). */
  mode: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(100, v)) / 100;

/** Seconds from the pick to full volume (0 → 50 ms, 50 → ≈0.9 s, 100 → 2.55 s). */
export function slowGearRiseSec(riseTime: number): number {
  return 0.05 + clamp01(riseTime) ** 1.5 * 2.5;
}

/** Whether a pick of `velocity` (0–1) is strong enough to start a swell at this Sens. */
export function slowGearTriggers(velocity: number, sens: number): boolean {
  return velocity >= 0.95 - clamp01(sens) * 0.85;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Em – C – G – D notes, alternating harder and softer picks. */
const NOTES: { midi: number; velocity: number }[] = [
  { midi: 64, velocity: 1 },
  { midi: 60, velocity: 0.45 },
  { midi: 67, velocity: 0.75 },
  { midi: 62, velocity: 0.25 },
];
const NOTE_LEN_SEC = 4;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

/**
 * Browser-only volume swell: each guitar note fades in over Rise Time when the pick is
 * hard enough for Sens. Picks below the Sens threshold are not swelled and stay quiet.
 */
export class SlowGearPreviewEngine {
  private cfg: SlowGearPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private buffers: AudioBuffer[] = [];
  private nodes: { master: GainNode; level: GainNode } | null = null;
  private nextTime = 0;
  private index = 0;
  private lastNote: GainNode | null = null;

  constructor(cfg: SlowGearPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: SlowGearPreviewConfig): void {
    this.cfg = cfg;
    const ctx = this.ctx;
    if (ctx && this.nodes) {
      this.nodes.level.gain.setTargetAtTime(clamp01(cfg.level) * 2, ctx.currentTime, 0.03);
    }
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.buffers.length === 0) {
      const sr = ctx.sampleRate;
      this.buffers = NOTES.map(({ midi }) => {
        const buf = ctx.createBuffer(1, Math.round(sr * NOTE_LEN_SEC), sr);
        const data = buf.getChannelData(0);
        pluckString(data, sr, midiHz(midi), 0, 0.4);
        pluckString(data, sr, midiHz(midi + 12), Math.round(sr * 0.004), 0.15);
        return buf;
      });
    }
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    const level = ctx.createGain();
    level.gain.value = clamp01(this.cfg.level) * 2;
    level.connect(master);
    this.nodes = { master, level };
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

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextTime;
      const i = this.index % NOTES.length;
      const { velocity } = NOTES[i]!;
      const src = ctx.createBufferSource();
      src.buffer = this.buffers[i]!;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      if (slowGearTriggers(velocity, this.cfg.sens)) {
        const rise = slowGearRiseSec(this.cfg.riseTime);
        if (this.cfg.mode === 0) env.gain.linearRampToValueAtTime(velocity, t + rise);
        else env.gain.setTargetAtTime(velocity, t, rise / 3);
      } else {
        env.gain.linearRampToValueAtTime(velocity * 0.08, t + 0.01);
      }
      src.connect(env).connect(this.nodes.level);
      const prev = this.lastNote?.gain;
      if (prev) {
        if (typeof prev.cancelAndHoldAtTime === "function") prev.cancelAndHoldAtTime(t);
        prev.setTargetAtTime(0, t, 0.04);
      }
      this.lastNote = env;
      src.start(t);
      src.stop(t + NOTE_LEN_SEC);
      this.index++;
      this.nextTime += (60 / Math.max(20, this.cfg.bpm)) * 4;
    }
  }
}
