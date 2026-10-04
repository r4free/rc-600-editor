import { pluckString } from "./chorusPreview";

export type DelayKind = "delay" | "panning" | "reverse" | "mod";

export interface DelayPreviewConfig {
  bpm: number;
  kind: DelayKind;
  /** Raw Time value: 0–11 note lengths, then 12 + (ms − 1). */
  timeRaw: number;
  feedback: number;
  modDepth: number;
  /** Low cut corner in Hz, or null for FLAT. */
  loCutHz: number | null;
  /** High cut corner in Hz, or null for FLAT. */
  hiCutHz: number | null;
  dryLevel: number;
  wetLevel: number;
}

/** Note lengths stored before the millisecond values, in beats. */
export const DELAY_NOTE_BEATS = [1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 4 / 3, 2, 4, 8, 16];
const NOTE_COUNT = DELAY_NOTE_BEATS.length;
const MAX_DELAY_SEC = 20;

export function delayTimeSec(raw: number, bpm: number): number {
  if (raw < NOTE_COUNT) return Math.min(MAX_DELAY_SEC, (DELAY_NOTE_BEATS[Math.max(0, raw)]! * 60) / Math.max(20, bpm));
  return Math.max(1, Math.min(2000, raw - NOTE_COUNT + 1)) / 1000;
}

/** Feedback 0–100 → loop gain, kept just below runaway. */
export function feedbackGain(feedback: number): number {
  return (Math.max(0, Math.min(100, feedback)) / 100) * 0.95;
}

/**
 * Scrub positions for Time: every note length, then milliseconds in steps that grow with the
 * time (1 ms up to 50, 5 ms up to 300, 10 ms up to 1000, 20 ms up to 2000).
 */
export function delayTimeSteps(): number[] {
  const out = Array.from({ length: NOTE_COUNT }, (_, i) => i);
  const push = (ms: number) => out.push(NOTE_COUNT + ms - 1);
  for (let ms = 1; ms < 50; ms++) push(ms);
  for (let ms = 50; ms < 300; ms += 5) push(ms);
  for (let ms = 300; ms < 1000; ms += 10) push(ms);
  for (let ms = 1000; ms <= 2000; ms += 20) push(ms);
  return out;
}

/** Index of the scrub position closest to a raw Time value. */
export function nearestStep(steps: number[], raw: number): number {
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i]! - raw) < Math.abs(steps[best]! - raw)) best = i;
  }
  return best;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const NOTE_SEC = 0.32;

/** A minor pentatonic phrase, two plucks per bar. */
const PHRASE = [69, 72, 76, 74, 72, 67, 69, 64];
const HIT_BEATS = [0, 0.5];

function renderPluck(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.round(sr * NOTE_SEC), sr);
  const data = buf.getChannelData(0);
  pluckString(data, sr, midiHz(midi), 0, 0.5);
  const release = Math.round(0.08 * sr);
  for (let i = data.length - release; i < data.length; i++) data[i]! *= (data.length - i) / release;
  return buf;
}

function reversed(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(1, buf.length, buf.sampleRate);
  const src = buf.getChannelData(0);
  const dst = out.getChannelData(0);
  for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i]!;
  return out;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const PARAM_GLIDE_SEC = 0.03;
const MOD_RATE_HZ = 0.6;
const MOD_MAX_SEC = 0.004;
const MAX_REVERSE_REPEATS = 24;

/** Browser-only plucked phrase through a delay built from the editor's settings. */
export class DelayPreviewEngine {
  private cfg: DelayPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private plucks: { fwd: AudioBuffer; rev: AudioBuffer }[] = [];
  private nodes: {
    master: GainNode;
    input: GainNode;
    dry: GainNode;
    wet: GainNode;
    lowCut: BiquadFilterNode;
    highCut: BiquadFilterNode;
    left: DelayNode;
    right: DelayNode;
    loop: GainNode;
    cross: GainNode;
    back: GainNode;
    panL: StereoPannerNode;
    panR: StereoPannerNode;
    lfo: OscillatorNode;
    lfoDepth: GainNode;
    reverseBus: GainNode;
  } | null = null;
  private nextHitTime = 0;
  private hitIndex = 0;
  private routedReverse: boolean | null = null;

  constructor(cfg: DelayPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: DelayPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.plucks.length === 0) {
      this.plucks = PHRASE.map((m) => {
        const fwd = renderPluck(ctx, m);
        return { fwd, rev: reversed(ctx, fwd) };
      });
    }
    this.buildGraph(ctx);
    this.nextHitTime = ctx.currentTime + 0.05;
    this.hitIndex = 0;
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
        nodes.lfo.stop();
        nodes.master.disconnect();
      }, 200);
    }
    this.nodes = null;
    this.routedReverse = null;
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

  /**
   * input → left delay → filters → loop gain → left delay (repeats).
   * Panning ping-pongs instead: filtered left repeat → right delay → back into the left delay,
   * so repeats alternate L and R. Reverse feeds scheduled reversed copies straight into the filters.
   */
  private buildGraph(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    input.connect(dry).connect(master);
    wet.connect(master);
    const left = ctx.createDelay(MAX_DELAY_SEC);
    const right = ctx.createDelay(MAX_DELAY_SEC);
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = "highpass";
    const highCut = ctx.createBiquadFilter();
    highCut.type = "lowpass";
    const loop = ctx.createGain();
    const cross = ctx.createGain();
    const back = ctx.createGain();
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    lowCut.connect(highCut);
    highCut.connect(panL).connect(wet);
    highCut.connect(loop).connect(left);
    highCut.connect(cross).connect(right).connect(panR).connect(wet);
    right.connect(back).connect(left);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = MOD_RATE_HZ;
    const lfoDepth = ctx.createGain();
    lfo.connect(lfoDepth).connect(left.delayTime);
    lfo.start();
    const reverseBus = ctx.createGain();
    reverseBus.connect(lowCut);
    this.nodes = {
      master,
      input,
      dry,
      wet,
      lowCut,
      highCut,
      left,
      right,
      loop,
      cross,
      back,
      panL,
      panR,
      lfo,
      lfoDepth,
      reverseBus,
    };
    this.applySettings();
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const { kind } = this.cfg;
    const time = delayTimeSec(this.cfg.timeRaw, this.cfg.bpm);
    const fb = feedbackGain(this.cfg.feedback);
    const panning = kind === "panning";
    const reverse = kind === "reverse";
    if (this.routedReverse !== reverse) {
      if (this.routedReverse === false) {
        n.input.disconnect(n.left);
        n.left.disconnect(n.lowCut);
      }
      if (!reverse) {
        n.input.connect(n.left);
        n.left.connect(n.lowCut);
      }
      this.routedReverse = reverse;
    }
    n.left.delayTime.setTargetAtTime(time, t, PARAM_GLIDE_SEC);
    n.right.delayTime.setTargetAtTime(time, t, PARAM_GLIDE_SEC);
    n.loop.gain.setTargetAtTime(reverse || panning ? 0 : fb, t, PARAM_GLIDE_SEC);
    n.cross.gain.setTargetAtTime(panning ? fb : 0, t, PARAM_GLIDE_SEC);
    n.back.gain.setTargetAtTime(panning ? fb : 0, t, PARAM_GLIDE_SEC);
    n.panL.pan.setTargetAtTime(panning ? -0.9 : 0, t, PARAM_GLIDE_SEC);
    n.panR.pan.setTargetAtTime(0.9, t, PARAM_GLIDE_SEC);
    const depth = kind === "mod" ? (Math.max(0, Math.min(100, this.cfg.modDepth)) / 100) * MOD_MAX_SEC : 0;
    n.lfoDepth.gain.setTargetAtTime(depth, t, PARAM_GLIDE_SEC);
    n.lowCut.frequency.setTargetAtTime(this.cfg.loCutHz ?? 10, t, PARAM_GLIDE_SEC);
    n.highCut.frequency.setTargetAtTime(this.cfg.hiCutHz ?? 20000, t, PARAM_GLIDE_SEC);
    const level = (v: number, max: number) => Math.max(0, Math.min(max, v)) / 100;
    n.dry.gain.setTargetAtTime(level(this.cfg.dryLevel, 100), t, PARAM_GLIDE_SEC);
    n.wet.gain.setTargetAtTime(level(this.cfg.wetLevel, 120), t, PARAM_GLIDE_SEC);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const beat = 60 / Math.max(20, this.cfg.bpm);
    while (this.nextHitTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const step = this.hitIndex % HIT_BEATS.length;
      const pluck = this.plucks[this.hitIndex % this.plucks.length]!;
      this.play(this.nextHitTime, pluck);
      const barStart = this.nextHitTime - HIT_BEATS[step]! * beat;
      this.hitIndex++;
      const nextStep = this.hitIndex % HIT_BEATS.length;
      this.nextHitTime = (nextStep === 0 ? barStart + 4 * beat : barStart) + HIT_BEATS[nextStep]! * beat;
    }
  }

  private play(t: number, pluck: { fwd: AudioBuffer; rev: AudioBuffer }): void {
    const ctx = this.ctx!;
    const n = this.nodes!;
    const src = ctx.createBufferSource();
    src.buffer = pluck.fwd;
    src.connect(n.input);
    src.start(t);
    if (this.cfg.kind !== "reverse") return;
    const time = delayTimeSec(this.cfg.timeRaw, this.cfg.bpm);
    const fb = feedbackGain(this.cfg.feedback);
    const clip = Math.min(time, pluck.rev.duration);
    let gain = 1;
    for (let k = 1; k <= MAX_REVERSE_REPEATS && gain > 0.01; k++) {
      const echo = ctx.createBufferSource();
      echo.buffer = pluck.rev;
      const g = ctx.createGain();
      g.gain.value = gain;
      echo.connect(g).connect(n.reverseBus);
      echo.start(t + time * k, pluck.rev.duration - clip, clip);
      gain *= fb;
    }
  }
}
