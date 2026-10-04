import { lfoRateHz } from "./stepPreview";

export interface ChorusPreviewConfig {
  bpm: number;
  rateIndex: number;
  depth: number;
  /** Low cut corner in Hz, or null for FLAT. */
  loCutHz: number | null;
  /** High cut corner in Hz, or null for FLAT. */
  hiCutHz: number | null;
  dryLevel: number;
  wetLevel: number;
}

/** "20.0 Hz" → 20, "1.25 kHz" → 1250, "FLAT" → null. */
export function cutLabelHz(label: string | undefined): number | null {
  const m = label?.match(/^([\d.]+)\s*(k?)Hz$/i);
  if (!m) return null;
  return parseFloat(m[1]!) * (m[2] ? 1000 : 1);
}

const CHORUS_BASE_DELAY_SEC = 0.012;
const CHORUS_MAX_SWEEP_SEC = 0.004;
/** Above this LFO rate the sweep shrinks so faster rates shimmer instead of warbling off pitch. */
const CHORUS_SWEEP_REF_HZ = 1.5;

/** Modulated delay for a chorus: fixed base, sweep from Depth scaled down at fast rates. */
export function chorusSettings(depth: number, rateHz: number): { delaySec: number; sweepSec: number } {
  const d = Math.max(0, Math.min(100, depth)) / 100;
  return {
    delaySec: CHORUS_BASE_DELAY_SEC,
    sweepSec: (d * CHORUS_MAX_SWEEP_SEC) / Math.max(1, rateHz / CHORUS_SWEEP_REF_HZ),
  };
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** G – Em – C – D, open voicings low to high. */
export const GUITAR_PROGRESSION: number[][] = [
  [43, 47, 50, 55, 59, 67],
  [40, 47, 52, 55, 59, 64],
  [48, 52, 55, 60, 64],
  [50, 57, 62, 66],
];

/** Beat offsets in a 4/4 bar, strum direction and loudness. */
const STRUM_PATTERN: { beat: number; down: boolean; velocity: number }[] = [
  { beat: 0, down: true, velocity: 1 },
  { beat: 1, down: true, velocity: 0.7 },
  { beat: 1.5, down: false, velocity: 0.45 },
  { beat: 2.5, down: false, velocity: 0.5 },
  { beat: 3, down: true, velocity: 0.7 },
  { beat: 3.5, down: false, velocity: 0.45 },
];

const STRUM_LEN_SEC = 2.2;

/** Karplus–Strong plucked string, mixed into `out` starting at `offset` samples. */
export function pluckString(out: Float32Array, sampleRate: number, freq: number, offset: number, gain: number, rand = Math.random): void {
  const period = Math.max(2, Math.round(sampleRate / freq));
  const ring = new Float32Array(period);
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const noise = rand() * 2 - 1;
    prev = prev * 0.5 + noise * 0.5;
    ring[i] = prev;
  }
  const decay = 0.996;
  let idx = 0;
  for (let n = offset; n < out.length; n++) {
    const next = (idx + 1) % period;
    const y = ring[idx]!;
    ring[idx] = (y + ring[next]!) * 0.5 * decay;
    out[n]! += y * gain;
    idx = next;
  }
}

function renderStrum(ctx: BaseAudioContext, notes: number[], down: boolean): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.round(sr * STRUM_LEN_SEC), sr);
  const data = buf.getChannelData(0);
  const strings = down ? notes : [...notes].reverse().slice(0, 4);
  const spacing = down ? 0.012 : 0.008;
  strings.forEach((m, i) => pluckString(data, sr, midiHz(m), Math.round(i * spacing * sr), 0.28));
  return buf;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const PARAM_GLIDE_SEC = 0.03;

/** Browser-only strummed guitar chords through a chorus built from the editor's settings. */
export class ChorusPreviewEngine {
  private cfg: ChorusPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private strums: { down: AudioBuffer; up: AudioBuffer }[] = [];
  private nodes: {
    master: GainNode;
    input: GainNode;
    dry: GainNode;
    wet: GainNode;
    lowCut: BiquadFilterNode;
    highCut: BiquadFilterNode;
    lfo: OscillatorNode;
    sweeps: GainNode[];
    delays: DelayNode[];
  } | null = null;
  private nextStrumTime = 0;
  private strumIndex = 0;
  private lastStrum: GainNode | null = null;

  constructor(cfg: ChorusPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: ChorusPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.strums.length === 0) {
      this.strums = GUITAR_PROGRESSION.map((notes) => ({
        down: renderStrum(ctx, notes, true),
        up: renderStrum(ctx, notes, false),
      }));
    }
    this.buildGraph(ctx);
    this.nextStrumTime = ctx.currentTime + 0.05;
    this.strumIndex = 0;
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
    this.lastStrum = null;
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
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = "highpass";
    const highCut = ctx.createBiquadFilter();
    highCut.type = "lowpass";
    input.connect(lowCut).connect(highCut);
    const lfo = ctx.createOscillator();
    lfo.start();
    const sides = [-1, 1].map((side) => {
      const delay = ctx.createDelay(0.05);
      const sweep = ctx.createGain();
      const pan = ctx.createStereoPanner();
      pan.pan.value = side * 0.8;
      lfo.connect(sweep).connect(delay.delayTime);
      highCut.connect(delay).connect(pan).connect(wet);
      return { delay, sweep };
    });
    this.nodes = {
      master,
      input,
      dry,
      wet,
      lowCut,
      highCut,
      lfo,
      sweeps: sides.map((s) => s.sweep),
      delays: sides.map((s) => s.delay),
    };
    this.applySettings();
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const rateHz = lfoRateHz(this.cfg.rateIndex, this.cfg.bpm);
    const { delaySec, sweepSec } = chorusSettings(this.cfg.depth, rateHz);
    n.lfo.frequency.setTargetAtTime(rateHz, t, 0.01);
    n.sweeps.forEach((g, i) => g.gain.setTargetAtTime(i === 0 ? sweepSec : -sweepSec, t, PARAM_GLIDE_SEC));
    n.delays.forEach((d) => d.delayTime.setTargetAtTime(delaySec, t, PARAM_GLIDE_SEC));
    n.lowCut.frequency.setTargetAtTime(this.cfg.loCutHz ?? 10, t, PARAM_GLIDE_SEC);
    n.highCut.frequency.setTargetAtTime(this.cfg.hiCutHz ?? 20000, t, PARAM_GLIDE_SEC);
    const level = (v: number) => Math.max(0, Math.min(100, v)) / 100;
    n.dry.gain.setTargetAtTime(level(this.cfg.dryLevel), t, PARAM_GLIDE_SEC);
    n.wet.gain.setTargetAtTime(level(this.cfg.wetLevel), t, PARAM_GLIDE_SEC);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const beat = 60 / Math.max(20, this.cfg.bpm);
    while (this.nextStrumTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const stepInBar = this.strumIndex % STRUM_PATTERN.length;
      const bar = Math.floor(this.strumIndex / STRUM_PATTERN.length);
      const hit = STRUM_PATTERN[stepInBar]!;
      const barStart = this.nextStrumTime - hit.beat * beat;
      this.strum(this.nextStrumTime, bar % GUITAR_PROGRESSION.length, hit.down, hit.velocity);
      this.strumIndex++;
      const next = STRUM_PATTERN[this.strumIndex % STRUM_PATTERN.length]!;
      const nextBarStart = stepInBar === STRUM_PATTERN.length - 1 ? barStart + 4 * beat : barStart;
      this.nextStrumTime = nextBarStart + next.beat * beat;
    }
  }

  private strum(t: number, chord: number, down: boolean, velocity: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.strums[chord]![down ? "down" : "up"];
    const g = ctx.createGain();
    g.gain.value = velocity;
    src.connect(g).connect(this.nodes!.input);
    if (this.lastStrum) {
      this.lastStrum.gain.setTargetAtTime(0, t, 0.04);
    }
    this.lastStrum = g;
    src.start(t);
    src.stop(t + STRUM_LEN_SEC);
  }
}
