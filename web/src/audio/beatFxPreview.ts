export type BeatFxEffect = "scatter" | "repeat" | "shift" | "flick";

export interface BeatFxPreviewConfig {
  bpm: number;
  effect: BeatFxEffect;
  /** TYPE index: Scatter P1–P4, Repeat FORWARD/REWIND/MIX, Shift FUTURE/PAST. */
  mode: number;
  /** LENGTH / SHIFT in beats (quarter notes); null = THRU. */
  lengthBeats: number | null;
  /** Vinyl Flick FLICK 0–100 (50 = normal speed). */
  flick: number;
}

/** One played slice of the track, in seconds relative to the effect window. */
export interface BeatGrain {
  /** When the slice starts, from the start of the effect window. */
  at: number;
  /** Track position the slice starts from, relative to where the track was when the effect began. */
  offset: number;
  dur: number;
  /** Plays the slice [offset, offset + span) backwards. */
  reverse: boolean;
  span: number;
  /** Playback rate at the start of the slice; it glides back to 1. */
  rate: number;
}

/** Note-value label (LENGTH / SHIFT list) → beats; THRU or unknown → null. */
export function beatLengthBeats(label: string): number | null {
  const meas = /^(\d+)MEAS$/.exec(label);
  if (meas) return Number(meas[1]) * 4;
  const note = /^1\/(\d+)(T|\.)?$/.exec(label);
  if (!note) return null;
  const beats = 4 / Number(note[1]);
  if (note[2] === "T") return (beats * 2) / 3;
  if (note[2] === ".") return beats * 1.5;
  return beats;
}

/** FLICK 0–100 → playback rate at the touch (0.25× – 1 – 2×). */
export function flickRate(flick: number): number {
  const v = Math.max(0, Math.min(100, flick));
  return v <= 50 ? 0.25 + (0.75 * v) / 50 : 1 + (v - 50) / 50;
}

/** Scatter P1–P4: slice order and reversed slices over 8 slices. */
export const SCATTER_PATTERNS: ReadonlyArray<{ order: number[]; reverse: number[] }> = [
  { order: [0, 0, 2, 2, 4, 4, 6, 6], reverse: [] },
  { order: [0, 1, 2, 3, 4, 5, 6, 7], reverse: [1, 3, 5, 7] },
  { order: [0, 3, 2, 1, 4, 7, 6, 5], reverse: [] },
  { order: [0, 2, 1, 3, 4, 6, 5, 7], reverse: [3, 7] },
];

/** Slices played while the effect is on, over a window of `windowBeats`. */
export function beatFxPlan(
  cfg: Pick<BeatFxPreviewConfig, "effect" | "mode" | "lengthBeats" | "flick">,
  beatSec: number,
  windowBeats: number,
): BeatGrain[] {
  const window = windowBeats * beatSec;
  const whole: BeatGrain = { at: 0, offset: 0, dur: window, reverse: false, span: window, rate: 1 };
  if (cfg.effect === "flick") {
    const rate = flickRate(cfg.flick);
    if (rate === 1) return [whole];
    return Array.from({ length: windowBeats }, (_, k) => ({
      at: k * beatSec,
      offset: k * beatSec,
      dur: beatSec,
      reverse: false,
      span: beatSec,
      rate,
    }));
  }
  if (cfg.lengthBeats === null || cfg.lengthBeats <= 0) return [whole];
  const len = cfg.lengthBeats * beatSec;
  if (cfg.effect === "shift") {
    return [{ ...whole, offset: cfg.mode === 1 ? -len : len }];
  }
  const grains: BeatGrain[] = [];
  for (let k = 0; k * len < window - 1e-6; k++) {
    const at = k * len;
    const dur = Math.min(len, window - at);
    if (cfg.effect === "repeat") {
      const reverse = cfg.mode === 1 || (cfg.mode === 2 && k % 2 === 1);
      grains.push({ at, offset: 0, dur, reverse, span: len, rate: 1 });
    } else {
      const pattern = SCATTER_PATTERNS[Math.max(0, Math.min(3, cfg.mode))]!;
      const slice = k % pattern.order.length;
      const base = Math.floor(k / pattern.order.length) * pattern.order.length;
      grains.push({
        at,
        offset: (base + pattern.order[slice]!) * len,
        dur,
        reverse: pattern.reverse.includes(slice),
        span: len,
        rate: 1,
      });
    }
  }
  return grains;
}

/** Bars of the stand-in track; each cycle plays it once clean, then again with the effect on its last bars. */
export const BEAT_TRACK_BARS = 4;
/** Bars at the end of the second pass with the effect on. */
export const BEAT_FX_ON_BARS = 2;
const TRACK_BARS = BEAT_TRACK_BARS;
const CYCLE_BARS = TRACK_BARS * 2;
const FX_START_BAR = CYCLE_BARS - BEAT_FX_ON_BARS;

/** Where the preview is in its cycle at a given bar. */
export function beatFxCycleState(bar: number): { trackBar: number; pass: 1 | 2; fxOn: boolean } {
  const cycleBar = mod(bar, CYCLE_BARS);
  return {
    trackBar: cycleBar % TRACK_BARS,
    pass: cycleBar < TRACK_BARS ? 1 : 2,
    fxOn: cycleBar >= FX_START_BAR,
  };
}
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.15;
const FADE = 0.004;

/** Melody (MIDI) per eighth note: a line that never repeats, so a repeated or moved slice stands out. */
const MELODY = [
  60, 64, 67, 72, 74, 76, 79, 84,
  81, 79, 76, 72, 69, 72, 76, 81,
  77, 76, 72, 69, 65, 69, 72, 77,
  79, 83, 86, 91, 89, 86, 83, 79,
];
/** Bass root per beat (C, Am, F, G). */
const BASS = [36, 36, 43, 36, 33, 33, 40, 45, 41, 41, 48, 41, 43, 43, 47, 50];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Renders the four-bar drum, bass, and melody phrase the effects play with. */
export function renderBeatTrack(sampleRate: number, bpm: number): Float32Array<ArrayBuffer> {
  const beat = 60 / Math.max(20, bpm);
  const length = Math.round(TRACK_BARS * 4 * beat * sampleRate);
  const out = new Float32Array(length);
  let seed = 1;
  const noise = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };
  const add = (startSec: number, durSec: number, fn: (t: number) => number) => {
    const s0 = Math.round(startSec * sampleRate);
    const n = Math.min(length - s0, Math.round(durSec * sampleRate));
    for (let i = 0; i < n; i++) out[s0 + i]! += fn(i / sampleRate);
  };
  const six = beat / 4;
  for (let i = 0; i < TRACK_BARS * 16; i++) {
    const t = i * six;
    const step = i % 16;
    if (step === 0 || step === 8 || step === 10) {
      add(t, 0.3, (x) => {
        const phase = 2 * Math.PI * (45 * x + (105 * (1 - Math.exp(-x / 0.04))) * 0.04);
        return Math.sin(phase) * 0.8 * Math.exp(-x / 0.08);
      });
    }
    if (i === 0) {
      let last = 0;
      add(t, 1.2, (x) => {
        const n = noise();
        const hp = n - last;
        last = n;
        return hp * 0.18 * Math.exp(-x / 0.45);
      });
    }
    const fill = i >= (TRACK_BARS - 1) * 16 + 12;
    if (step === 4 || step === 12 || fill) {
      add(t, 0.18, (x) => (noise() * 0.35 + Math.sin(2 * Math.PI * 190 * x) * 0.2) * Math.exp(-x / 0.05));
    }
    if (i % 2 === 0) {
      let last = 0;
      add(t, 0.05, (x) => {
        const n = noise();
        const hp = n - last;
        last = n;
        return hp * (step % 4 === 2 ? 0.12 : 0.06) * Math.exp(-x / 0.012);
      });
    }
  }
  const eighth = beat / 2;
  MELODY.forEach((m, k) => {
    const f = midiHz(m);
    add(k * eighth, eighth * 0.95, (x) => {
      const env = Math.min(1, x / 0.005) * Math.exp(-x / 0.18);
      return (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(4 * Math.PI * f * x)) * 0.16 * env;
    });
  });
  BASS.forEach((m, k) => {
    const f = midiHz(m);
    add(k * beat, beat * 0.9, (x) => {
      const env = Math.min(1, x / 0.008) * Math.exp(-x / 0.35);
      return Math.tanh(2 * Math.sin(2 * Math.PI * f * x)) * 0.22 * env;
    });
  });
  return out;
}

const mod = (v: number, m: number) => ((v % m) + m) % m;


/** Clips a planned slice to [from, to) seconds of the effect window, keeping the source position right. */
export function clipGrain(g: BeatGrain, from: number, to: number): BeatGrain | null {
  const start = Math.max(g.at, from);
  const end = Math.min(g.at + g.dur, to);
  if (end - start < 1e-6) return null;
  const d0 = start - g.at;
  const dur = end - start;
  if (g.reverse) return { ...g, at: start, dur, offset: g.offset + g.span - d0 - dur, span: dur };
  return { ...g, at: start, dur, offset: g.offset + d0 };
}

/** "auto" runs the demo cycle; true / false is the Effect switch. */
export type BeatFxSwitch = "auto" | boolean;

const TRACK_BEATS = TRACK_BARS * 4;

/**
 * Browser-only Beat FX over a four-bar drum, bass, and melody track. The Effect switch turns the
 * effect on and off like the pedal's FX switch, synced to the next beat; "auto" plays the track once
 * clean and then again with the effect on its last two bars.
 */
export class BeatFxPreviewEngine {
  private cfg: BeatFxPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private master: GainNode | null = null;
  private track: { bpm: number; forward: AudioBuffer; reversed: AudioBuffer } | null = null;
  private mode: BeatFxSwitch = false;
  private nextBeat = 0;
  private beat = 0;
  private engaged: { beat: number; t: number; pos: number } | null = null;
  private last: { env: GainNode; end: number; src: number; reverse: boolean; plain: boolean } | null = null;
  private marks: { t: number; trackBar: number; pass: 1 | 2; fxOn: boolean; auto: boolean }[] = [];

  constructor(cfg: BeatFxPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  setEffect(mode: BeatFxSwitch): void {
    this.mode = mode;
  }

  /** What is sounding now: clean track or effect, and the bar of the track. */
  status(): { text: string; active: boolean } | null {
    const now = this.ctx?.currentTime;
    if (!this.playing || now === undefined) return null;
    const mark = [...this.marks].reverse().find((m) => m.t <= now);
    if (!mark) return null;
    const bar = `Bar ${mark.trackBar + 1}/${TRACK_BARS}`;
    if (mark.fxOn) return { text: `Effect ON · ${bar}`, active: true };
    if (!mark.auto) return { text: `Effect OFF · ${bar}`, active: false };
    return { text: `${mark.pass === 1 ? "Original" : "Original, effect next"} · ${bar}`, active: false };
  }

  update(cfg: BeatFxPreviewConfig): void {
    this.cfg = cfg;
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    this.master = master;
    this.ensureTrack(Math.max(20, Math.round(this.cfg.bpm)));
    this.nextBeat = ctx.currentTime + 0.05;
    this.beat = 0;
    this.engaged = null;
    this.last = null;
    this.marks = [];
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    const master = this.master;
    if (ctx && master) {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(() => master.disconnect(), 200);
    }
    this.master = null;
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

  private ensureTrack(bpm: number) {
    const ctx = this.ctx!;
    if (this.track?.bpm === bpm) return this.track;
    const data = renderBeatTrack(ctx.sampleRate, bpm);
    const forward = ctx.createBuffer(1, data.length, ctx.sampleRate);
    forward.copyToChannel(data, 0);
    const reversed = ctx.createBuffer(1, data.length, ctx.sampleRate);
    reversed.copyToChannel(data.slice().reverse(), 0);
    this.track = { bpm, forward, reversed };
    return this.track;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    while (this.nextBeat < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const trackBeat = mod(this.beat, TRACK_BEATS);
      if (trackBeat === 0 && !this.engaged) this.ensureTrack(Math.max(20, Math.round(this.cfg.bpm)));
      const beatSec = 60 / this.track!.bpm;
      const t = this.nextBeat;
      const auto = this.mode === "auto";
      const cycle = beatFxCycleState(Math.floor(this.beat / 4));
      const fxOn = auto ? cycle.fxOn : this.mode === true;
      if (fxOn && !this.engaged) this.engaged = { beat: this.beat, t, pos: trackBeat * beatSec };
      if (!fxOn) this.engaged = null;
      if (this.engaged) {
        const k = this.beat - this.engaged.beat;
        for (const g of beatFxPlan(this.cfg, beatSec, k + 1)) {
          const clip = clipGrain(g, k * beatSec, (k + 1) * beatSec);
          if (clip) this.grain(this.engaged.t, clip, this.engaged.pos);
        }
      } else {
        this.grain(t, { at: 0, offset: 0, dur: beatSec, reverse: false, span: beatSec, rate: 1 }, trackBeat * beatSec);
      }
      this.marks.push({ t, trackBar: Math.floor(trackBeat / 4), pass: cycle.pass, fxOn, auto });
      if (this.marks.length > 32) this.marks.shift();
      this.beat++;
      this.nextBeat += beatSec;
    }
  }

  private grain(t0: number, g: BeatGrain, pos: number): void {
    const ctx = this.ctx!;
    const track = this.track!;
    const len = track.forward.duration;
    const t = t0 + g.at;
    const srcStart = g.reverse ? mod(pos + g.offset + g.span, len) : mod(pos + g.offset, len);
    const plain = g.rate === 1;
    const last = this.last;
    const gap = last ? Math.abs(mod(srcStart - last.src + len / 2, len) - len / 2) : Infinity;
    const contiguous =
      last !== null && plain && last.plain && last.reverse === g.reverse && Math.abs(last.end - t) < 1e-4 && gap < 1e-3;
    if (last && !contiguous && last.end - FADE > ctx.currentTime) {
      last.env.gain.setValueAtTime(1, last.end - FADE);
      last.env.gain.linearRampToValueAtTime(0, last.end);
    }
    const src = ctx.createBufferSource();
    src.buffer = g.reverse ? track.reversed : track.forward;
    src.loop = true;
    if (!plain) {
      src.playbackRate.setValueAtTime(g.rate, t);
      src.playbackRate.exponentialRampToValueAtTime(1, t + g.dur * 0.7);
    }
    const env = ctx.createGain();
    if (contiguous) {
      env.gain.setValueAtTime(1, t);
    } else {
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(1, t + FADE);
    }
    src.connect(env).connect(this.master!);
    src.start(t, g.reverse ? mod(len - srcStart, len) : srcStart);
    src.stop(t + g.dur);
    this.last = {
      env,
      end: t + g.dur,
      src: g.reverse ? mod(srcStart - g.dur, len) : mod(srcStart + g.dur, len),
      reverse: g.reverse,
      plain,
    };
  }
}
