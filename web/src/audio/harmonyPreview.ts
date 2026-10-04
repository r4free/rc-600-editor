import { formantRatio } from "./robotPreview";

export interface HarmonyPreviewConfig {
  bpm: number;
  /** HRM MANUAL (diatonic intervals in the Key) or HRM AUTO (follows the chords). */
  kind: "manual" | "auto";
  /** Raw VOICE index (see MANUAL_STEPS / AUTO_VOICES order). */
  voice: number;
  /** Raw FORMANT 0–100 (−50…+50). */
  formant: number;
  /** Raw PAN 0–100 (L50…R50). */
  pan: number;
  /** KEY 0–11: C (Am) … B (G#m). */
  key: number;
  dLevel: number;
  hrmLevel: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
/** HRM MANUAL voices (OCT-, OCT+, -6TH … +6TH, UNISON) as diatonic scale steps. */
const MANUAL_STEPS = [-7, 7, -5, -4, -3, -2, 2, 3, 4, 5, 0];
/** HRM AUTO voices: OCT-, OCT+, LOWER, LOW, HIGH, HIGHER, UNISON. */
const AUTO_VOICES = ["oct-", "oct+", "lower", "low", "high", "higher", "unison"] as const;
export const UNISON_MANUAL = 10;
export const UNISON_AUTO = 6;

/** MIDI note of a scale degree (0 = tonic, may be negative or above 6) in the major key, tonic near C4. */
export function degreeMidi(key: number, degree: number): number {
  const oct = Math.floor(degree / 7);
  const d = ((degree % 7) + 7) % 7;
  return 60 + (((key % 12) + 12) % 12) + oct * 12 + MAJOR[d]!;
}

/** HRM MANUAL: the harmony note a diatonic interval away from the sung degree. */
export function manualHarmonyMidi(key: number, degree: number, voice: number): number {
  return degreeMidi(key, degree + (MANUAL_STEPS[voice] ?? 0));
}

/** HRM AUTO: the nearest chord tones above (HIGH, HIGHER) or below (LOW, LOWER) the sung note. */
export function autoHarmonyMidi(key: number, degree: number, chordRoot: number, voice: number): number {
  const sung = degreeMidi(key, degree);
  const name = AUTO_VOICES[voice] ?? "high";
  if (name === "oct-") return sung - 12;
  if (name === "oct+") return sung + 12;
  if (name === "unison") return sung;
  const tones: number[] = [];
  for (let d = chordRoot - 14; d <= chordRoot + 14; d++) {
    const rel = (((d - chordRoot) % 7) + 7) % 7;
    if (rel === 0 || rel === 2 || rel === 4) tones.push(degreeMidi(key, d));
  }
  const above = tones.filter((m) => m > sung);
  const below = tones.filter((m) => m < sung).reverse();
  if (name === "high") return above[0]!;
  if (name === "higher") return above[1]!;
  if (name === "low") return below[0]!;
  return below[1]!;
}

/** Sung melody as scale degrees in eighths; one bar per chord. */
const MELODY: { degree: number; eighths: number }[] = [
  { degree: 0, eighths: 2 },
  { degree: 2, eighths: 1 },
  { degree: 4, eighths: 1 },
  { degree: 5, eighths: 2 },
  { degree: 4, eighths: 2 },
  { degree: 3, eighths: 2 },
  { degree: 2, eighths: 1 },
  { degree: 3, eighths: 1 },
  { degree: 4, eighths: 2 },
  { degree: 2, eighths: 2 },
  { degree: 1, eighths: 2 },
  { degree: 3, eighths: 2 },
  { degree: 2, eighths: 2 },
  { degree: 1, eighths: 1 },
  { degree: 0, eighths: 1 },
  { degree: 0, eighths: 4 },
];
/** I – vi – IV – V roots (scale degrees), one per bar. */
const CHORD_ROOTS = [0, 5, 3, 4];
const FORMANTS: [number, number][] = [
  [730, 2.4],
  [1090, 1.5],
  [2440, 0.7],
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.03;

/** Browser-only Harmonist: a sung melody plus a harmony voice (and soft chords for HRM AUTO). */
export class HarmonyPreviewEngine {
  private cfg: HarmonyPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nodes: { master: GainNode; dry: GainNode; hrm: GainNode; pan: StereoPannerNode; pad: GainNode } | null =
    null;
  private nextEighth = 0;
  private eighth = 0;
  private noteIndex = 0;
  private left = 0;

  constructor(cfg: HarmonyPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: HarmonyPreviewConfig): void {
    this.cfg = cfg;
    this.applyMix();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const dry = ctx.createGain();
    dry.connect(master);
    const pan = ctx.createStereoPanner();
    pan.connect(master);
    const hrm = ctx.createGain();
    hrm.connect(pan);
    const pad = ctx.createGain();
    pad.connect(master);
    this.nodes = { master, dry, hrm, pan, pad };
    this.applyMix();
    this.nextEighth = ctx.currentTime + 0.05;
    this.eighth = 0;
    this.noteIndex = 0;
    this.left = 0;
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
    const t = ctx.currentTime;
    n.dry.gain.setTargetAtTime(Math.max(0, Math.min(100, this.cfg.dLevel)) / 100, t, GLIDE);
    n.hrm.gain.setTargetAtTime(Math.max(0, Math.min(100, this.cfg.hrmLevel)) / 100, t, GLIDE);
    n.pan.pan.setTargetAtTime((Math.max(0, Math.min(100, this.cfg.pan)) - 50) / 50, t, GLIDE);
    n.pad.gain.setTargetAtTime(this.cfg.kind === "auto" ? 1 : 0, t, GLIDE);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    while (this.nextEighth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextEighth;
      const bar = Math.floor(this.eighth / 8);
      const chordRoot = CHORD_ROOTS[bar % CHORD_ROOTS.length]!;
      if (this.eighth % 8 === 0) this.chord(t, chordRoot, eighthSec * 8);
      if (this.left <= 0) {
        const note = MELODY[this.noteIndex % MELODY.length]!;
        const dur = note.eighths * eighthSec;
        const key = this.cfg.key;
        const sung = degreeMidi(key, note.degree);
        const harmony =
          this.cfg.kind === "manual"
            ? manualHarmonyMidi(key, note.degree, this.cfg.voice)
            : autoHarmonyMidi(key, note.degree, chordRoot, this.cfg.voice);
        const unison = this.cfg.voice === (this.cfg.kind === "manual" ? UNISON_MANUAL : UNISON_AUTO);
        this.sing(t, sung, dur, 1, this.nodes.dry, 0);
        this.sing(unison ? t + 0.025 : t, harmony, dur, formantRatio(this.cfg.formant), this.nodes.hrm, unison ? 14 : 0);
        this.left = note.eighths;
        this.noteIndex++;
      }
      this.left--;
      this.eighth++;
      this.nextEighth += eighthSec;
    }
  }

  private sing(t: number, midi: number, dur: number, ratio: number, out: AudioNode, detune: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.4, t + 0.04);
    env.gain.setValueAtTime(0.4, t + dur * 0.85);
    env.gain.linearRampToValueAtTime(0, t + dur * 0.98);
    env.connect(out);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiHz(midi);
    osc.detune.value = detune;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 12;
    vib.connect(vibDepth).connect(osc.detune);
    for (const [hz, gain] of FORMANTS) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz * ratio;
      bp.Q.value = 7;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(bp).connect(g).connect(env);
    }
    const end = t + dur + 0.05;
    osc.start(t);
    vib.start(t);
    osc.stop(end);
    vib.stop(end);
  }

  private chord(t: number, root: number, dur: number): void {
    const ctx = this.ctx!;
    for (const d of [root, root + 2, root + 4]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiHz(degreeMidi(this.cfg.key, d) - 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.08);
      g.gain.setTargetAtTime(0, t + dur * 0.9, 0.08);
      osc.connect(g).connect(this.nodes!.pad);
      osc.start(t);
      osc.stop(t + dur + 0.4);
    }
  }
}
