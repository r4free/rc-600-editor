import { syncRateBeats, type StepTarget } from "@rc600/catalog/input-fx";

export type PreviewSound = "tone" | "beat" | "synth" | "ring" | "phaser" | "flanger" | "tremolo";

export interface StepPreviewConfig {
  /** Step values 0–100 (all 16, even past Step Max). */
  steps: readonly number[];
  /** Number of steps that play (Step Max + 1). */
  activeCount: number;
  rateIndex: number;
  bpm: number;
  target: StepTarget;
  sound: PreviewSound;
  metronome: boolean;
  /** Step Sync: step 1 is cued at the start of every preview loop (one measure, or the step if longer). */
  stepSync?: boolean;
  /** Retrigger: Play restarts at step 1 (true) or picks up where the free-running sequence is (false). */
  retrigger?: boolean;
  /** How strongly the step pattern is applied (0 = dry/full level, 100 = full pattern). */
  depth?: number;
  /** Compressor threshold in dB. */
  compressorThresholdDb?: number;
  /** Compressor makeup gain in dB. */
  compressorGainDb?: number;
  /** Simulates the Vibrato effect itself; the steps drive `stepParam` (none when Sequence is OFF). */
  vibrato?: VibratoPreview;
  /** Simulates the Ring Modulator itself; the steps drive Frequency when `stepFrequency` is on. */
  ring?: RingPreview;
  /** Simulates the Phaser itself; the steps drive `stepParam` (none when Sequence is OFF). */
  phaser?: PhaserPreview;
  /** Simulates the Flanger itself; the steps drive `stepParam` (none when Sequence is OFF). */
  flanger?: FlangerPreview;
  /** Simulates the Tremolo itself; the steps drive `stepParam` (none when Sequence is OFF). */
  tremolo?: TremoloPreview;
}

export interface TremoloPreview {
  rateIndex: number;
  depth: number;
  waveform: number;
  level: number;
  stepParam: "rate" | "depth" | null;
}

/** A 0–100 step value as a free (non-synced) Rate index. */
export function freeRateIndex(stepValue: number): number {
  return FREE_RATE_OFFSET + Math.max(0, Math.min(100, Math.round(stepValue)));
}

/**
 * Volume swing (Depth: 1 = dips to silence), LFO shaping (Waveform: 1 = sine, higher = squarer)
 * and output gain (Level 50 = unity).
 */
export function tremoloSettings(
  depth: number,
  waveform: number,
  level: number,
): { swing: number; sharpness: number; outputGain: number } {
  const clamp = (v: number) => Math.max(0, Math.min(100, v)) / 100;
  return {
    swing: clamp(depth),
    sharpness: 1 + clamp(waveform) ** 2 * 30,
    outputGain: clamp(level) * 2,
  };
}

/** Normalized tanh curve: sharpness 1 ≈ sine, high values ≈ square. */
export function tremoloCurve(sharpness: number, size = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const norm = Math.tanh(sharpness);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(sharpness * x) / norm;
  }
  return curve;
}

export interface FlangerPreview {
  rateIndex: number;
  depth: number;
  resonance: number;
  manual: number;
  separation: number;
  dryLevel: number;
  wetLevel: number;
  stepParam: "depth" | "resonance" | "manual" | "separation" | "dryLevel" | "wetLevel" | null;
}

const FLANGER_MIN_DELAY_SEC = 0.0005;
const FLANGER_MAX_DELAY_SEC = 0.008;
const FLANGER_MAX_FEEDBACK = 0.9;

/**
 * Center delay (Manual: higher = shorter = brighter), LFO swing (Depth, never below 0.1 ms),
 * feedback (Resonance) and the right channel's sweep direction (Separation: 1 = same, −1 = opposite).
 */
export function flangerSettings(
  manual: number,
  depth: number,
  resonance: number,
  separation: number,
): { delaySec: number; sweepSec: number; feedback: number; rightSweep: number } {
  const clamp = (v: number) => Math.max(0, Math.min(100, v)) / 100;
  const delaySec = FLANGER_MAX_DELAY_SEC * (FLANGER_MIN_DELAY_SEC / FLANGER_MAX_DELAY_SEC) ** clamp(manual);
  return {
    delaySec,
    sweepSec: clamp(depth) * (delaySec - 0.0001),
    feedback: clamp(resonance) * FLANGER_MAX_FEEDBACK,
    rightSweep: 1 - 2 * clamp(separation),
  };
}

export interface PhaserPreview {
  rateIndex: number;
  depth: number;
  resonance: number;
  manual: number;
  dryLevel: number;
  wetLevel: number;
  stepParam: "depth" | "resonance" | "manual" | "dryLevel" | "wetLevel" | null;
}

const PHASER_STAGES = [1, 1.6, 2.6, 4.2];
const PHASER_MIN_HZ = 150;
const PHASER_OCTAVES = 5;
const PHASER_MAX_SWEEP_CENTS = 2400;

/** All-pass center (Manual), LFO sweep in cents (Depth) and filter Q (Resonance). */
export function phaserSettings(
  manual: number,
  depth: number,
  resonance: number,
): { centerHz: number; sweepCents: number; q: number } {
  const clamp = (v: number) => Math.max(0, Math.min(100, v)) / 100;
  return {
    centerHz: PHASER_MIN_HZ * 2 ** (clamp(manual) * PHASER_OCTAVES),
    sweepCents: clamp(depth) * PHASER_MAX_SWEEP_CENTS,
    q: 0.4 + clamp(resonance) * 7.6,
  };
}

export interface RingPreview {
  frequency: number;
  balance: number;
  stepFrequency: boolean;
}

const RING_MIN_HZ = 30;
const RING_MAX_HZ = 3000;

/** Ring carrier frequency for a 0–100 value (exponential 30 Hz – 3 kHz). */
export function ringFrequencyHz(value: number): number {
  const v = Math.max(0, Math.min(100, value)) / 100;
  return RING_MIN_HZ * (RING_MAX_HZ / RING_MIN_HZ) ** v;
}

export interface VibratoPreview {
  rateIndex: number;
  depth: number;
  color: number;
  dryLevel: number;
  wetLevel: number;
  stepParam: "depth" | "dryLevel" | "wetLevel" | null;
}

const VIBRATO_MAX_CENTS = 100;
/** Peak pitch ratio swing at Depth 100 (~1 semitone). */
const VIBRATO_MAX_SWING = 0.06;
const VIBRATO_MAX_DELAY_SEC = 0.015;
const VIBRATO_BASE_DELAY_SEC = 0.002;
const COLOR_LFO_RATIO = 2.71;

/** Vibrato wobble speed in Hz: one cycle per note value, or the free 0–100 scale. */
export function lfoRateHz(rateIndex: number, bpm: number): number {
  return 1 / stepDurationSec(rateIndex, bpm);
}

/**
 * Delay-line vibrato amounts: a delay swinging by `main` seconds at `rateHz` bends pitch by
 * about 2π·rate·main, so the swing is scaled to keep Depth 100 near one semitone at any Rate.
 */
export function vibratoDelay(rateHz: number, depth: number, color: number): { main: number; color: number } {
  const d = Math.max(0, Math.min(100, depth)) / 100;
  const c = Math.max(0, Math.min(100, color)) / 100;
  const main = Math.min(VIBRATO_MAX_DELAY_SEC, (d * VIBRATO_MAX_SWING) / (2 * Math.PI * Math.max(0.1, rateHz)));
  return { main, color: (main * c * 0.6) / COLOR_LFO_RATIO };
}

const SCHEDULE_AHEAD_SEC = 0.12;
const LOOKAHEAD_MS = 25;
const PARAM_GLIDE_SEC = 0.006;
const FREE_RATE_OFFSET = 18;
const BASE_FREQ = 220;
const ARP = [0, 4, 7, 12];

/** Seconds per step: note rates follow the BPM, free rates (0–100) map to 0.5–16 steps/s. */
export function stepDurationSec(rateIndex: number, bpm: number): number {
  const beats = syncRateBeats(rateIndex);
  if (beats !== null) return (60 / Math.max(20, bpm)) * beats;
  const free = Math.max(0, Math.min(100, rateIndex - FREE_RATE_OFFSET));
  return 1 / (0.5 + (free / 100) * 15.5);
}

/** Maps a 0–100 step value to the preview parameter for the effect family. */
export function stepValueToTarget(target: StepTarget, value: number): number {
  const v = Math.max(0, Math.min(100, value)) / 100;
  switch (target) {
    case "volume":
      return v;
    case "filter":
      return 150 * 2 ** (v * 6.5);
    case "pitch":
      return (v - 0.5) * 2400;
    case "pan":
      return v * 2 - 1;
    case "vibrato":
      return v * VIBRATO_MAX_CENTS;
    case "ring":
      return ringFrequencyHz(value);
    case "phaser":
    case "flanger":
    case "tremolo":
      return v;
  }
}

/** Blends a step level with the unaffected full level according to Depth. */
export function applyStepDepth(value: number, depth = 100): number {
  const step = Math.max(0, Math.min(100, value));
  const mix = Math.max(0, Math.min(100, depth)) / 100;
  return 100 + (step - 100) * mix;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Browser-only reference sound shaped by a step sequence (no MIDI, no samples). */
export class StepPreviewEngine {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cfg: StepPreviewConfig;
  private onStep: (index: number) => void;

  private master: GainNode | null = null;
  private stepGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private panner: StereoPannerNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private compressorGain: GainNode | null = null;
  private vib: {
    lfos: OscillatorNode[];
    mainMod: GainNode;
    colorMod: GainNode;
    dry: GainNode;
    wet: GainNode;
  } | null = null;
  private ringNodes: { carrier: OscillatorNode; dry: GainNode; wet: GainNode } | null = null;
  private phaserNodes: {
    lfo: OscillatorNode;
    sweep: GainNode;
    stages: BiquadFilterNode[];
    dry: GainNode;
    wet: GainNode;
  } | null = null;
  private flangerNodes: {
    lfo: OscillatorNode;
    sweepL: GainNode;
    sweepR: GainNode;
    delays: DelayNode[];
    feedbacks: GainNode[];
    pans: StereoPannerNode[];
    dry: GainNode;
    wet: GainNode;
  } | null = null;
  private tremNodes: {
    lfo: OscillatorNode;
    shaper: WaveShaperNode;
    sharpness: number;
    swing: GainNode;
    amp: GainNode;
    output: GainNode;
  } | null = null;
  private toneOscs: OscillatorNode[] = [];
  private noiseSrc: AudioBufferSourceNode | null = null;
  private noise: AudioBuffer | null = null;

  private nextStepTime = 0;
  private stepIndex = 0;
  private nextGridTime = 0;
  private gridIndex = 0;
  private nextLoopTime = 0;
  private freeOrigin: number | null = null;
  private pitchCents = 0;
  private lastStep = -1;
  private uiTimers = new Set<number>();

  constructor(cfg: StepPreviewConfig, onStep: (index: number) => void) {
    this.cfg = cfg;
    this.onStep = onStep;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: StepPreviewConfig): void {
    const soundChanged =
      cfg.sound !== this.cfg.sound ||
      cfg.target !== this.cfg.target ||
      !cfg.vibrato !== !this.cfg.vibrato ||
      !cfg.ring !== !this.cfg.ring ||
      !cfg.phaser !== !this.cfg.phaser ||
      !cfg.flanger !== !this.cfg.flanger ||
      !cfg.tremolo !== !this.cfg.tremolo;
    this.cfg = cfg;
    this.updatePreviewControls();
    if (this.playing && soundChanged) {
      this.stop();
      this.start();
    }
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    this.lastStep = -1;
    this.buildGraph(ctx);
    const t = ctx.currentTime + 0.05;
    this.nextGridTime = t;
    this.gridIndex = 0;
    this.nextLoopTime = t + this.loopDurationSec();
    if (this.cfg.retrigger === false && !this.cfg.stepSync && this.freeOrigin !== null) {
      const dur = stepDurationSec(this.cfg.rateIndex, this.cfg.bpm);
      const elapsed = Math.ceil((t - this.freeOrigin) / dur);
      this.stepIndex = elapsed % this.stepCount();
      this.nextStepTime = this.freeOrigin + elapsed * dur;
    } else {
      this.freeOrigin = t;
      this.stepIndex = 0;
      this.nextStepTime = t;
    }
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const id of this.uiTimers) clearTimeout(id);
    this.uiTimers.clear();
    const ctx = this.ctx;
    if (ctx && this.master) {
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      const old = {
        master: this.master,
        oscs: [
          ...this.toneOscs,
          ...(this.vib?.lfos ?? []),
          ...(this.ringNodes ? [this.ringNodes.carrier] : []),
          ...(this.phaserNodes ? [this.phaserNodes.lfo] : []),
          ...(this.flangerNodes ? [this.flangerNodes.lfo] : []),
          ...(this.tremNodes ? [this.tremNodes.lfo] : []),
          ...(this.noiseSrc ? [this.noiseSrc] : []),
        ],
      };
      setTimeout(() => {
        for (const o of old.oscs) o.stop();
        old.master.disconnect();
      }, 120);
    }
    this.master = null;
    this.toneOscs = [];
    this.vib = null;
    this.ringNodes = null;
    this.phaserNodes = null;
    this.flangerNodes = null;
    this.tremNodes = null;
    this.noiseSrc = null;
    this.onStep(-1);
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
      this.noise = noiseBuffer(this.ctx);
    }
    return this.ctx;
  }

  private buildGraph(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    const panner = ctx.createStereoPanner();
    const compressor = ctx.createDynamicsCompressor();
    const compressorGain = ctx.createGain();
    panner.connect(compressor).connect(compressorGain).connect(master);
    const stepGain = ctx.createGain();
    const simulated = this.cfg.vibrato || this.cfg.ring || this.cfg.phaser || this.cfg.flanger || this.cfg.tremolo;
    stepGain.gain.value = this.cfg.target === "volume" && !simulated ? 0 : 1;
    if (this.cfg.tremolo) {
      const lfo = ctx.createOscillator();
      const shaper = ctx.createWaveShaper();
      const swing = ctx.createGain();
      const amp = ctx.createGain();
      const output = ctx.createGain();
      lfo.connect(shaper).connect(swing).connect(amp.gain);
      lfo.start();
      stepGain.connect(amp).connect(output).connect(panner);
      this.tremNodes = { lfo, shaper, sharpness: -1, swing, amp, output };
    } else if (this.cfg.flanger) {
      const lfo = ctx.createOscillator();
      lfo.type = "triangle";
      lfo.start();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      stepGain.connect(dry).connect(panner);
      wet.connect(panner);
      const sides = [0, 1].map(() => {
        const delay = ctx.createDelay(0.05);
        const sweep = ctx.createGain();
        const feedback = ctx.createGain();
        const pan = ctx.createStereoPanner();
        lfo.connect(sweep).connect(delay.delayTime);
        stepGain.connect(delay).connect(pan).connect(wet);
        delay.connect(feedback).connect(delay);
        return { delay, sweep, feedback, pan };
      });
      this.flangerNodes = {
        lfo,
        sweepL: sides[0]!.sweep,
        sweepR: sides[1]!.sweep,
        delays: sides.map((s) => s.delay),
        feedbacks: sides.map((s) => s.feedback),
        pans: sides.map((s) => s.pan),
        dry,
        wet,
      };
    } else if (this.cfg.phaser) {
      const lfo = ctx.createOscillator();
      const sweep = ctx.createGain();
      lfo.connect(sweep);
      lfo.start();
      const stages = PHASER_STAGES.map(() => {
        const ap = ctx.createBiquadFilter();
        ap.type = "allpass";
        sweep.connect(ap.detune);
        return ap;
      });
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      stepGain.connect(dry).connect(panner);
      stages.reduce<AudioNode>((prev, ap) => prev.connect(ap), stepGain).connect(wet).connect(panner);
      this.phaserNodes = { lfo, sweep, stages, dry, wet };
    } else if (this.cfg.ring) {
      const carrier = ctx.createOscillator();
      const multiplier = ctx.createGain();
      multiplier.gain.value = 0;
      carrier.connect(multiplier.gain);
      carrier.start();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      stepGain.connect(dry).connect(panner);
      stepGain.connect(multiplier).connect(wet).connect(panner);
      this.ringNodes = { carrier, dry, wet };
    } else if (this.cfg.vibrato) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = VIBRATO_BASE_DELAY_SEC + VIBRATO_MAX_DELAY_SEC;
      const mainMod = ctx.createGain();
      const colorMod = ctx.createGain();
      mainMod.connect(delay.delayTime);
      colorMod.connect(delay.delayTime);
      const lfos = (["sine", "triangle"] as OscillatorType[]).map((type, i) => {
        const lfo = ctx.createOscillator();
        lfo.type = type;
        lfo.connect(i === 0 ? mainMod : colorMod);
        lfo.start();
        return lfo;
      });
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      stepGain.connect(dry).connect(panner);
      stepGain.connect(delay).connect(wet).connect(panner);
      this.vib = { lfos, mainMod, colorMod, dry, wet };
    } else {
      stepGain.connect(panner);
    }
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = this.cfg.target === "filter" ? 6 : 0.7;
    filter.frequency.value = this.cfg.target === "filter" ? 600 : 18000;
    filter.connect(stepGain);
    this.master = master;
    this.panner = panner;
    this.compressor = compressor;
    this.compressorGain = compressorGain;
    this.stepGain = stepGain;
    this.filter = filter;
    this.updatePreviewControls();
    this.pitchCents = 0;

    if (this.cfg.sound === "flanger" && this.noise) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      src.connect(g).connect(filter);
      src.start();
      this.noiseSrc = src;
    }

    if (
      this.cfg.sound === "tone" ||
      this.cfg.sound === "ring" ||
      this.cfg.sound === "phaser" ||
      this.cfg.sound === "flanger" ||
      this.cfg.sound === "tremolo"
    ) {
      const shapes: [OscillatorType, number, number][] =
        this.cfg.sound === "ring"
          ? [
              ["triangle", BASE_FREQ, 0.55],
              ["sine", BASE_FREQ * 1.5, 0.3],
              ["sine", BASE_FREQ * 2, 0.25],
            ]
          : this.cfg.sound === "phaser"
            ? [
                ["sawtooth", BASE_FREQ / 2, 0.3],
                ["sawtooth", BASE_FREQ * 0.75 * 1.004, 0.22],
                ["sawtooth", BASE_FREQ * 0.996, 0.22],
                ["square", BASE_FREQ * 1.5, 0.1],
              ]
            : this.cfg.sound === "flanger"
              ? [
                  ["sawtooth", BASE_FREQ / 2, 0.35],
                  ["sawtooth", BASE_FREQ, 0.25],
                  ["sawtooth", BASE_FREQ * 1.5, 0.15],
                ]
              : this.cfg.sound === "tremolo"
                ? [
                    ["triangle", BASE_FREQ / 2, 0.45],
                    ["sine", BASE_FREQ * 1.26, 0.3],
                    ["triangle", BASE_FREQ * 1.5, 0.25],
                    ["sine", BASE_FREQ * 2, 0.15],
                  ]
                : [
              ["sawtooth", BASE_FREQ, 0.5],
              ["square", BASE_FREQ / 2, 0.25],
            ];
      this.toneOscs = shapes.map(([type, freq, level]) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g).connect(filter);
        osc.start();
        return osc;
      });
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD_SEC;
    while (this.nextStepTime < horizon) {
      if (this.cfg.stepSync && this.nextStepTime >= this.nextLoopTime - 1e-6) {
        this.nextStepTime = this.nextLoopTime;
        this.stepIndex = 0;
      }
      while (this.nextLoopTime <= this.nextStepTime + 1e-6) this.nextLoopTime += this.loopDurationSec();
      this.scheduleStep(this.nextStepTime, this.stepIndex);
      this.nextStepTime += stepDurationSec(this.cfg.rateIndex, this.cfg.bpm);
      this.stepIndex = (this.stepIndex + 1) % this.stepCount();
    }
    const sixteenth = 60 / Math.max(20, this.cfg.bpm) / 4;
    while (this.nextGridTime < horizon) {
      this.scheduleGrid(this.nextGridTime, this.gridIndex);
      this.nextGridTime += sixteenth;
      this.gridIndex = (this.gridIndex + 1) % 16;
    }
  }

  private stepCount(): number {
    return Math.max(1, Math.min(16, this.cfg.activeCount));
  }

  private loopDurationSec(): number {
    const measure = (60 / Math.max(20, this.cfg.bpm)) * 4;
    const step = stepDurationSec(this.cfg.rateIndex, this.cfg.bpm);
    return Math.ceil(step / measure - 1e-6) * measure;
  }

  private scheduleStep(t: number, index: number): void {
    const ctx = this.ctx!;
    const raw = this.cfg.steps[index] ?? 0;
    const step = this.cfg.target === "volume" ? applyStepDepth(raw, this.cfg.depth) : raw;
    const value = stepValueToTarget(this.cfg.target, step);
    const vibrato = this.cfg.vibrato;
    this.lastStep = index;
    const ring = this.cfg.ring;
    const phaser = this.cfg.phaser;
    const flanger = this.cfg.flanger;
    const tremolo = this.cfg.tremolo;
    if (tremolo) {
      if (tremolo.stepParam) this.applyTremolo(this.tremoloWithStep(tremolo, raw), t);
    } else if (flanger) {
      if (flanger.stepParam) this.applyFlanger({ ...flanger, [flanger.stepParam]: raw }, t);
    } else if (phaser) {
      if (phaser.stepParam) this.applyPhaser({ ...phaser, [phaser.stepParam]: raw }, t);
    } else if (ring) {
      if (ring.stepFrequency) this.applyRing({ ...ring, frequency: raw }, t);
    } else if (vibrato) {
      if (vibrato.stepParam) this.applyVibrato({ ...vibrato, [vibrato.stepParam]: raw }, t);
    } else switch (this.cfg.target) {
      case "volume":
        this.stepGain!.gain.setTargetAtTime(value, t, PARAM_GLIDE_SEC);
        break;
      case "filter":
        this.filter!.frequency.setTargetAtTime(value, t, PARAM_GLIDE_SEC);
        break;
      case "pitch":
        this.pitchCents = value;
        for (const o of this.toneOscs) o.detune.setTargetAtTime(value, t, PARAM_GLIDE_SEC);
        break;
      case "pan":
        this.panner!.pan.setTargetAtTime(value, t, PARAM_GLIDE_SEC);
        break;
      case "vibrato":
      case "ring":
      case "phaser":
      case "flanger":
      case "tremolo":
        break;
    }
    if (this.cfg.sound === "synth") {
      const semis = ARP[index % ARP.length]!;
      const len = Math.min(0.3, stepDurationSec(this.cfg.rateIndex, this.cfg.bpm) * 0.9);
      this.note(t, BASE_FREQ * 2 ** (semis / 12), len, "sawtooth", 0.45);
    }
    const id = window.setTimeout(() => {
      this.uiTimers.delete(id);
      this.onStep(index);
    }, Math.max(0, (t - ctx.currentTime) * 1000));
    this.uiTimers.add(id);
  }

  private updatePreviewControls(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const threshold = Math.max(-30, Math.min(0, this.cfg.compressorThresholdDb ?? 0));
    this.compressor?.threshold.setTargetAtTime(threshold, now, 0.01);
    if (this.compressor) {
      this.compressor.knee.setTargetAtTime(12, now, 0.01);
      this.compressor.ratio.setTargetAtTime(4, now, 0.01);
      this.compressor.attack.setTargetAtTime(0.006, now, 0.01);
      this.compressor.release.setTargetAtTime(0.18, now, 0.01);
    }
    const gainDb = Math.max(0, Math.min(20, this.cfg.compressorGainDb ?? 0));
    this.compressorGain?.gain.setTargetAtTime(10 ** (gainDb / 20), now, 0.01);
    const tremolo = this.cfg.tremolo;
    if (tremolo && this.tremNodes) {
      const live =
        tremolo.stepParam && this.lastStep >= 0
          ? this.tremoloWithStep(tremolo, this.cfg.steps[this.lastStep] ?? 0)
          : tremolo;
      this.applyTremolo(live, now);
    }
    const flanger = this.cfg.flanger;
    if (flanger && this.flangerNodes) {
      this.flangerNodes.lfo.frequency.setTargetAtTime(lfoRateHz(flanger.rateIndex, this.cfg.bpm), now, 0.01);
      const live =
        flanger.stepParam && this.lastStep >= 0 ? { [flanger.stepParam]: this.cfg.steps[this.lastStep] ?? 0 } : {};
      this.applyFlanger({ ...flanger, ...live }, now);
    }
    const phaser = this.cfg.phaser;
    if (phaser && this.phaserNodes) {
      this.phaserNodes.lfo.frequency.setTargetAtTime(lfoRateHz(phaser.rateIndex, this.cfg.bpm), now, 0.01);
      const live =
        phaser.stepParam && this.lastStep >= 0 ? { [phaser.stepParam]: this.cfg.steps[this.lastStep] ?? 0 } : {};
      this.applyPhaser({ ...phaser, ...live }, now);
    }
    const ring = this.cfg.ring;
    if (ring && this.ringNodes) {
      const live = ring.stepFrequency && this.lastStep >= 0 ? (this.cfg.steps[this.lastStep] ?? 0) : ring.frequency;
      this.applyRing({ ...ring, frequency: live }, now);
    }
    const vibrato = this.cfg.vibrato;
    if (vibrato && this.vib) {
      const hz = lfoRateHz(vibrato.rateIndex, this.cfg.bpm);
      this.vib.lfos.forEach((lfo, i) => lfo.frequency.setTargetAtTime(i === 0 ? hz : hz * COLOR_LFO_RATIO, now, 0.01));
      const live =
        vibrato.stepParam && this.lastStep >= 0
          ? { [vibrato.stepParam]: this.cfg.steps[this.lastStep] ?? 0 }
          : {};
      this.applyVibrato({ ...vibrato, ...live }, now);
    }
  }

  private tremoloWithStep(tr: TremoloPreview, raw: number): TremoloPreview {
    if (tr.stepParam === "rate") return { ...tr, rateIndex: freeRateIndex(raw) };
    if (tr.stepParam === "depth") return { ...tr, depth: raw };
    return tr;
  }

  private applyTremolo(tr: TremoloPreview, t: number): void {
    const nodes = this.tremNodes;
    if (!nodes) return;
    const { swing, sharpness, outputGain } = tremoloSettings(tr.depth, tr.waveform, tr.level);
    if (nodes.sharpness !== sharpness) {
      nodes.shaper.curve = tremoloCurve(sharpness);
      nodes.sharpness = sharpness;
    }
    nodes.lfo.frequency.setTargetAtTime(lfoRateHz(tr.rateIndex, this.cfg.bpm), t, 0.01);
    nodes.swing.gain.setTargetAtTime(swing / 2, t, PARAM_GLIDE_SEC);
    nodes.amp.gain.setTargetAtTime(1 - swing / 2, t, PARAM_GLIDE_SEC);
    nodes.output.gain.setTargetAtTime(outputGain, t, PARAM_GLIDE_SEC);
  }

  private applyFlanger(f: FlangerPreview, t: number): void {
    const nodes = this.flangerNodes;
    if (!nodes) return;
    const { delaySec, sweepSec, feedback, rightSweep } = flangerSettings(f.manual, f.depth, f.resonance, f.separation);
    const spread = Math.max(0, Math.min(100, f.separation)) / 100;
    nodes.sweepL.gain.setTargetAtTime(sweepSec, t, PARAM_GLIDE_SEC);
    nodes.sweepR.gain.setTargetAtTime(sweepSec * rightSweep, t, PARAM_GLIDE_SEC);
    nodes.delays.forEach((d) => d.delayTime.setTargetAtTime(delaySec, t, PARAM_GLIDE_SEC));
    nodes.feedbacks.forEach((g) => g.gain.setTargetAtTime(feedback, t, PARAM_GLIDE_SEC));
    nodes.pans.forEach((p, i) => p.pan.setTargetAtTime(i === 0 ? -spread : spread, t, PARAM_GLIDE_SEC));
    nodes.dry.gain.setTargetAtTime(Math.max(0, Math.min(100, f.dryLevel)) / 100, t, PARAM_GLIDE_SEC);
    nodes.wet.gain.setTargetAtTime((Math.max(0, Math.min(100, f.wetLevel)) / 100) * (1 - feedback * 0.5), t, PARAM_GLIDE_SEC);
  }

  private applyPhaser(p: PhaserPreview, t: number): void {
    if (!this.phaserNodes) return;
    const { centerHz, sweepCents, q } = phaserSettings(p.manual, p.depth, p.resonance);
    this.phaserNodes.sweep.gain.setTargetAtTime(sweepCents, t, PARAM_GLIDE_SEC);
    this.phaserNodes.stages.forEach((ap, i) => {
      ap.frequency.setTargetAtTime(centerHz * PHASER_STAGES[i]!, t, PARAM_GLIDE_SEC);
      ap.Q.setTargetAtTime(q, t, PARAM_GLIDE_SEC);
    });
    this.phaserNodes.dry.gain.setTargetAtTime(Math.max(0, Math.min(100, p.dryLevel)) / 100, t, PARAM_GLIDE_SEC);
    this.phaserNodes.wet.gain.setTargetAtTime(Math.max(0, Math.min(100, p.wetLevel)) / 100, t, PARAM_GLIDE_SEC);
  }

  private applyRing(r: RingPreview, t: number): void {
    if (!this.ringNodes) return;
    const balance = Math.max(0, Math.min(100, r.balance)) / 100;
    this.ringNodes.carrier.frequency.setTargetAtTime(ringFrequencyHz(r.frequency), t, PARAM_GLIDE_SEC);
    this.ringNodes.dry.gain.setTargetAtTime(1 - balance, t, PARAM_GLIDE_SEC);
    this.ringNodes.wet.gain.setTargetAtTime(balance * 1.4, t, PARAM_GLIDE_SEC);
  }

  private applyVibrato(v: VibratoPreview, t: number): void {
    if (!this.vib) return;
    const amounts = vibratoDelay(lfoRateHz(v.rateIndex, this.cfg.bpm), v.depth, v.color);
    this.vib.mainMod.gain.setTargetAtTime(amounts.main, t, PARAM_GLIDE_SEC);
    this.vib.colorMod.gain.setTargetAtTime(amounts.color, t, PARAM_GLIDE_SEC);
    this.vib.dry.gain.setTargetAtTime(Math.max(0, Math.min(100, v.dryLevel)) / 100, t, PARAM_GLIDE_SEC);
    this.vib.wet.gain.setTargetAtTime(Math.max(0, Math.min(100, v.wetLevel)) / 100, t, PARAM_GLIDE_SEC);
  }

  private scheduleGrid(t: number, index: number): void {
    if (this.cfg.metronome && index % 4 === 0) {
      this.click(t, index === 0);
    }
    if (this.cfg.sound !== "beat") return;
    if (index === 0 || index === 8 || index === 10) this.kick(t);
    if (index === 4 || index === 12) this.snare(t);
    if (index % 2 === 0) this.hat(t, index % 4 === 2 ? 0.18 : 0.1);
  }

  private envGain(t: number, peak: number, len: number, dest: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(dest);
    return g;
  }

  private note(t: number, freq: number, len: number, type: OscillatorType, peak: number): void {
    const osc = this.ctx!.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = this.pitchCents;
    osc.connect(this.envGain(t, peak, len, this.filter!));
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  private kick(t: number): void {
    const osc = this.ctx!.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    osc.detune.value = this.pitchCents;
    osc.connect(this.envGain(t, 0.9, 0.28, this.filter!));
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private noiseHit(t: number, peak: number, len: number, type: BiquadFilterType, freq: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.detune.value = this.pitchCents;
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.value = freq;
    src.connect(bp).connect(this.envGain(t, peak, len, this.filter!));
    src.start(t);
    src.stop(t + len + 0.02);
  }

  private snare(t: number): void {
    this.noiseHit(t, 0.5, 0.16, "bandpass", 1800);
    this.note(t, 190, 0.1, "triangle", 0.35);
  }

  private hat(t: number, peak: number): void {
    this.noiseHit(t, peak, 0.05, "highpass", 7000);
  }

  private click(t: number, accent: boolean): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = accent ? 1760 : 1100;
    osc.connect(this.envGain(t, accent ? 0.35 : 0.22, 0.035, this.master!));
    osc.start(t);
    osc.stop(t + 0.05);
  }
}
