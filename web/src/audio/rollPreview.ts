import { syncRateBeats } from "@rc600/catalog/input-fx";

export interface RollPreviewConfig {
  bpm: number;
  /** TIME: sync-rate index (note values, then free 0–100). */
  time: number;
  /** FEEDBACK (ROLL1) / REPEAT (ROLL2) 0–100: repetitions when ROLL is OFF. */
  repeat: number;
  /** ROLL 0–4: OFF, 1/2, 1/4, 1/8, 1/16. */
  roll: number;
  /** 0 = direct only, 100 = effect only. */
  balance: number;
  /** ROLL2's REPEAT reaches INF at the top of its range. */
  infiniteAtMax: boolean;
}

const NOTE_RATES = 18;

/** TIME → loop cycle (s): note values follow the tempo; free values 0–100 are 10 ms steps (min 1 ms). */
export function rollTimeSec(time: number, bpm: number): number {
  const beats = syncRateBeats(time);
  if (beats !== null) return (beats * 60) / Math.max(20, bpm);
  return Math.max(1, (time - NOTE_RATES) * 10) / 1000;
}

/** Length of one repeated slice: the TIME cycle split by ROLL (OFF = whole cycle). */
export function rollSliceSec(time: number, roll: number, bpm: number): number {
  return rollTimeSec(time, bpm) / 2 ** Math.max(0, Math.min(4, roll));
}

/** Loop feedback: ROLL on holds the slice; OFF fades it by FEEDBACK / REPEAT (INF holds too). */
export function rollFeedback(repeat: number, roll: number, infiniteAtMax: boolean): number {
  if (roll > 0) return 1;
  if (infiniteAtMax && repeat >= 100) return 1;
  return (Math.max(0, Math.min(100, repeat)) / 100) * 0.97;
}

/** Direct / effect gains for BALANCE (both full at the middle). */
export function rollMix(balance: number): { dry: number; wet: number } {
  const b = Math.max(0, Math.min(100, balance)) / 100;
  return { dry: Math.min(1, 2 * (1 - b)), wet: Math.min(1, 2 * b) };
}

const MELODY = [72, null, 76, 79, 77, null, 74, 76, 72, 74, null, 79, 81, 79, 77, 76];
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

/**
 * Browser-only Roll: a beat and melody; every other bar the effect is switched on, so the first
 * slice of the bar is captured and looped (split by ROLL, faded by FEEDBACK / REPEAT when OFF).
 */
export class RollPreviewEngine {
  private cfg: RollPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer | null = null;
  private nodes: { master: GainNode; input: GainNode; dry: GainNode } | null = null;
  private nextSixteenth = 0;
  private sixteenth = 0;

  constructor(cfg: RollPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: RollPreviewConfig): void {
    this.cfg = cfg;
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const dry = ctx.createGain();
    input.connect(dry).connect(master);
    this.nodes = { master, input, dry };
    this.nextSixteenth = ctx.currentTime + 0.05;
    this.sixteenth = 0;
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

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const sixteenthSec = 15 / Math.max(20, this.cfg.bpm);
    while (this.nextSixteenth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextSixteenth;
      const i = this.sixteenth % 16;
      if (i === 0 && Math.floor(this.sixteenth / 16) % 2 === 1) this.roll(t, sixteenthSec * 16);
      if (i === 0 || i === 8 || i === 10) this.kick(t);
      if (i === 4 || i === 12) this.hit(t, 0.4, 0.15, "bandpass", 1800);
      if (i % 2 === 0) this.hit(t, i % 4 === 2 ? 0.14 : 0.08, 0.04, "highpass", 7000);
      const note = MELODY[i];
      if (note != null) this.pluck(t, note, sixteenthSec * 1.6);
      this.sixteenth++;
      this.nextSixteenth += sixteenthSec;
    }
  }

  /** Effect on for one bar: capture the first slice, then loop it until the bar ends. */
  private roll(t: number, bar: number): void {
    const ctx = this.ctx!;
    const n = this.nodes!;
    const slice = Math.min(4, rollSliceSec(this.cfg.time, this.cfg.roll, this.cfg.bpm));
    const mix = rollMix(this.cfg.balance);
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(1, t);
    gate.gain.setValueAtTime(0, t + slice);
    const delay = ctx.createDelay(4.1);
    delay.delayTime.value = slice;
    const feedback = ctx.createGain();
    feedback.gain.value = rollFeedback(this.cfg.repeat, this.cfg.roll, this.cfg.infiniteAtMax);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(0, t);
    wet.gain.setValueAtTime(mix.wet, t + slice);
    wet.gain.setValueAtTime(mix.wet, t + bar - 0.01);
    wet.gain.linearRampToValueAtTime(0, t + bar);
    n.input.connect(gate).connect(delay).connect(wet).connect(n.master);
    delay.connect(feedback).connect(delay);
    n.dry.gain.setValueAtTime(1, t);
    n.dry.gain.setValueAtTime(mix.dry, t + slice);
    n.dry.gain.setValueAtTime(mix.dry, t + bar - 0.01);
    n.dry.gain.linearRampToValueAtTime(1, t + bar);
    setTimeout(
      () => {
        n.input.disconnect(gate);
        feedback.gain.value = 0;
        wet.disconnect();
      },
      (t + bar + 0.1 - ctx.currentTime) * 1000,
    );
  }

  private pluck(t: number, midi: number, len: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midiHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(g).connect(this.nodes!.input);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(this.nodes!.input);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private hit(t: number, peak: number, len: number, type: BiquadFilterType, hz: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(this.nodes!.input);
    src.start(t);
    src.stop(t + len + 0.02);
  }
}
