import { GUITAR_PROGRESSION, pluckString } from "./chorusPreview";

export type ReverbKind = "reverb" | "gate" | "reverse";

export interface ReverbShape {
  kind: ReverbKind;
  timeSec: number;
  /** Reverb: 1–10, sparse/grainy to smooth. */
  density: number;
  /** Gate: 0–100, level where the tail is cut. */
  threshold: number;
  /** Reverse: 0.1–1 s, length of the swell. */
  gateTimeSec: number;
}

export interface ReverbPreviewConfig extends ReverbShape {
  bpm: number;
  preDelayMs: number;
  /** Low cut corner in Hz, or null for FLAT. */
  loCutHz: number | null;
  /** High cut corner in Hz, or null for FLAT. */
  hiCutHz: number | null;
  dryLevel: number;
  wetLevel: number;
}

/** Amplitude falls by 60 dB over `timeSec` (RT60). */
const RT60_LN = Math.log(1000);

/** Gate threshold 0–100 → cut level from −60 dB (never cut early) to 0 dB (cut at once). */
export function gateCutSec(timeSec: number, threshold: number): number {
  const db = -60 + (Math.max(0, Math.min(100, threshold)) / 100) * 60;
  return Math.max(0.02, (timeSec * -db) / 60);
}

/** Share of samples that carry an echo: density 10 is a smooth wash, 1 a few grains. */
export function densityFill(density: number): number {
  const d = Math.max(1, Math.min(10, density));
  return 0.004 * (1 / 0.004) ** ((d - 1) / 9);
}

/** Stereo impulse response shaped like the RC-600 reverb types. */
export function reverbImpulse(
  shape: ReverbShape,
  sampleRate: number,
  rand = Math.random,
): Float32Array<ArrayBuffer>[] {
  const time = Math.max(0.1, shape.timeSec);
  const lengthSec =
    shape.kind === "gate"
      ? Math.min(time, gateCutSec(time, shape.threshold))
      : shape.kind === "reverse"
        ? Math.max(0.1, shape.gateTimeSec)
        : time;
  const len = Math.max(1, Math.round(lengthSec * sampleRate));
  const fade = Math.min(len, Math.round(0.005 * sampleRate));
  const fill = shape.kind === "reverb" ? densityFill(shape.density) : 1;
  const grain = 1 / Math.sqrt(fill);
  return [0, 1].map(() => {
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      if (fill < 1 && rand() >= fill) continue;
      const t = i / sampleRate;
      const env =
        shape.kind === "reverse" ? Math.exp((-RT60_LN * (lengthSec - t)) / time) : Math.exp((-RT60_LN * t) / time);
      const edge = shape.kind === "reverb" ? 1 : Math.min(1, (len - i) / fade);
      out[i] = (rand() * 2 - 1) * env * edge * grain;
    }
    return out;
  });
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const STAB_SEC = 0.28;
const SNARE_SEC = 0.18;

function renderStab(ctx: BaseAudioContext, notes: number[]): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.round(sr * STAB_SEC), sr);
  const data = buf.getChannelData(0);
  notes.forEach((m, i) => pluckString(data, sr, midiHz(m), Math.round(i * 0.01 * sr), 0.26));
  const release = Math.round(0.06 * sr);
  for (let i = data.length - release; i < data.length; i++) data[i]! *= (data.length - i) / release;
  return buf;
}

function renderSnare(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.round(sr * SNARE_SEC), sr);
  const data = buf.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = Math.random() * 2 - 1;
    const bright = noise - prev * 0.6;
    prev = noise;
    data[i] = bright * 0.5 * Math.exp(-t / 0.05) + Math.sin(2 * Math.PI * 185 * t) * 0.45 * Math.exp(-t / 0.03);
  }
  return buf;
}

/** Beat offsets in a 4/4 bar: chord stabs on 1 and 3, snare on 2 and 4. */
const HIT_PATTERN: { beat: number; hit: "stab" | "snare" }[] = [
  { beat: 0, hit: "stab" },
  { beat: 1, hit: "snare" },
  { beat: 2, hit: "stab" },
  { beat: 3, hit: "snare" },
];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const PARAM_GLIDE_SEC = 0.03;
const SWAP_SEC = 0.06;

function shapeKey(s: ReverbShape): string {
  return `${s.kind}|${s.timeSec}|${s.density}|${s.threshold}|${s.gateTimeSec}`;
}

/** Browser-only chord stabs and snare through a reverb built from the editor's settings. */
export class ReverbPreviewEngine {
  private cfg: ReverbPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stabs: AudioBuffer[] = [];
  private snare: AudioBuffer | null = null;
  private nodes: {
    master: GainNode;
    input: GainNode;
    dry: GainNode;
    wet: GainNode;
    preDelay: DelayNode;
    lowCut: BiquadFilterNode;
    highCut: BiquadFilterNode;
    verb: { conv: ConvolverNode; gain: GainNode } | null;
  } | null = null;
  private impulseKey = "";
  private nextHitTime = 0;
  private hitIndex = 0;

  constructor(cfg: ReverbPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: ReverbPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.stabs.length === 0) this.stabs = GUITAR_PROGRESSION.map((notes) => renderStab(ctx, notes));
    if (!this.snare) this.snare = renderSnare(ctx);
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
      setTimeout(() => nodes.master.disconnect(), 200);
    }
    this.nodes = null;
    this.impulseKey = "";
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
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    input.connect(dry).connect(master);
    wet.connect(master);
    const preDelay = ctx.createDelay(0.6);
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = "highpass";
    const highCut = ctx.createBiquadFilter();
    highCut.type = "lowpass";
    input.connect(preDelay).connect(lowCut).connect(highCut);
    this.nodes = { master, input, dry, wet, preDelay, lowCut, highCut, verb: null };
    this.applySettings();
  }

  private swapImpulse(ctx: AudioContext): void {
    const n = this.nodes!;
    const key = shapeKey(this.cfg);
    if (key === this.impulseKey) return;
    this.impulseKey = key;
    const channels = reverbImpulse(this.cfg, ctx.sampleRate);
    const buf = ctx.createBuffer(2, channels[0]!.length, ctx.sampleRate);
    channels.forEach((data, ch) => buf.copyToChannel(data, ch));
    const conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = buf;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + SWAP_SEC);
    n.highCut.connect(conv).connect(gain).connect(n.wet);
    const old = n.verb;
    if (old) {
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + SWAP_SEC);
      setTimeout(() => {
        n.highCut.disconnect(old.conv);
        old.gain.disconnect();
      }, SWAP_SEC * 1000 + 50);
    }
    n.verb = { conv, gain };
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    this.swapImpulse(ctx);
    n.preDelay.delayTime.setTargetAtTime(Math.max(0, Math.min(500, this.cfg.preDelayMs)) / 1000, t, PARAM_GLIDE_SEC);
    n.lowCut.frequency.setTargetAtTime(this.cfg.loCutHz ?? 10, t, PARAM_GLIDE_SEC);
    n.highCut.frequency.setTargetAtTime(this.cfg.hiCutHz ?? 20000, t, PARAM_GLIDE_SEC);
    const level = (v: number) => Math.max(0, Math.min(100, v)) / 100;
    n.dry.gain.setTargetAtTime(level(this.cfg.dryLevel), t, PARAM_GLIDE_SEC);
    n.wet.gain.setTargetAtTime(level(this.cfg.wetLevel) * 1.6, t, PARAM_GLIDE_SEC);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const beat = 60 / Math.max(20, this.cfg.bpm);
    while (this.nextHitTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const step = this.hitIndex % HIT_PATTERN.length;
      const bar = Math.floor(this.hitIndex / HIT_PATTERN.length);
      const hit = HIT_PATTERN[step]!;
      const buffer = hit.hit === "snare" ? this.snare! : this.stabs[bar % this.stabs.length]!;
      this.play(this.nextHitTime, buffer);
      const barStart = this.nextHitTime - hit.beat * beat;
      this.hitIndex++;
      const next = HIT_PATTERN[this.hitIndex % HIT_PATTERN.length]!;
      const nextBarStart = step === HIT_PATTERN.length - 1 ? barStart + 4 * beat : barStart;
      this.nextHitTime = nextBarStart + next.beat * beat;
    }
  }

  private play(t: number, buffer: AudioBuffer): void {
    const src = this.ctx!.createBufferSource();
    src.buffer = buffer;
    src.connect(this.nodes!.input);
    src.start(t);
  }
}
