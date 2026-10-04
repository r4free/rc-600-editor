import { formantRatio } from "./robotPreview";

export interface ElectricPreviewConfig {
  bpm: number;
  /** Raw SHIFT 0–24 (−12…+12 semitones). */
  shift: number;
  /** Raw FORMANT 0–100 (−50…+50). */
  formant: number;
  /** SPEED 0–10: how quickly the pitch changes. */
  speed: number;
  /** Raw STABILITY 0–20 (−10…+10): larger = more stable. */
  stability: number;
  /** SCALE: 0 = CHROMATIC, 1–12 = key C (Am) … B (G#m). */
  scale: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** Pitch classes the pitch snaps to: every semitone for CHROMATIC, else the major scale of the key. */
export function scaleNotes(scale: number): number[] {
  if (scale <= 0) return Array.from({ length: 12 }, (_, i) => i);
  const tonic = (Math.round(scale) - 1) % 12;
  return MAJOR.map((d) => (d + tonic) % 12).sort((a, b) => a - b);
}

/** Nearest MIDI note to `pitch` whose pitch class is in `notes`. */
export function nearestScaleNote(pitch: number, notes: number[]): number {
  let best = Math.round(pitch);
  let bestDist = Infinity;
  for (let m = Math.floor(pitch) - 2; m <= Math.ceil(pitch) + 2; m++) {
    if (!notes.includes(((m % 12) + 12) % 12)) continue;
    const d = Math.abs(m - pitch);
    if (d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

/** SPEED 0–10 → glide time constant (s): 0 slides slowly, 10 jumps instantly. */
export function electricGlideSec(speed: number): number {
  const s = Math.max(0, Math.min(10, speed)) / 10;
  return 0.003 + 0.12 * (1 - s);
}

/** STABILITY raw 0–20 → semitones the voice must drift before the note changes. */
export function electricThreshold(stability: number): number {
  const s = (Math.max(0, Math.min(20, stability)) - 10) / 10;
  return 0.5 + s * 0.35;
}

/** Sung melody (C major, eighth notes) with how far off-pitch each note is sung. */
const MELODY: { midi: number; eighths: number; off: number }[] = [
  { midi: 60, eighths: 1, off: 0.2 },
  { midi: 62, eighths: 1, off: -0.3 },
  { midi: 64, eighths: 2, off: 0.35 },
  { midi: 67, eighths: 1, off: -0.25 },
  { midi: 65, eighths: 1, off: 0.4 },
  { midi: 64, eighths: 2, off: -0.35 },
  { midi: 62, eighths: 1, off: 0.3 },
  { midi: 64, eighths: 1, off: -0.2 },
  { midi: 60, eighths: 2, off: 0.25 },
  { midi: 57, eighths: 2, off: -0.4 },
  { midi: 60, eighths: 2, off: 0.15 },
];
const MELODY_EIGHTHS = MELODY.reduce((n, m) => n + m.eighths, 0);
/** "ah" formants (Hz). */
const FORMANTS: [number, number, number][] = [
  [730, 1, 2.6],
  [1090, 1, 1.6],
  [2440, 1, 0.8],
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const CONTROL_SEC = 0.01;
const SCOOP_SEC = 0.06;

/** The natural sung pitch at `eighthPos` eighths into the melody: scoops into each note, with vibrato. */
function naturalPitch(eighthPos: number, eighthSec: number, t: number): { pitch: number; noteStart: boolean } {
  const pos = ((eighthPos % MELODY_EIGHTHS) + MELODY_EIGHTHS) % MELODY_EIGHTHS;
  let at = 0;
  for (let i = 0; i < MELODY.length; i++) {
    const n = MELODY[i]!;
    if (pos < at + n.eighths) {
      const prev = MELODY[(i + MELODY.length - 1) % MELODY.length]!;
      const since = (pos - at) * eighthSec;
      const target = n.midi + n.off;
      const from = prev.midi + prev.off;
      const pitch = target + (from - target) * Math.exp(-since / SCOOP_SEC) + Math.sin(2 * Math.PI * 5.5 * t) * 0.3;
      return { pitch, noteStart: since < CONTROL_SEC };
    }
    at += n.eighths;
  }
  return { pitch: 60, noteStart: false };
}

/** Browser-only Electric: a slightly off-pitch sung melody snapped to semitones or a key, with mechanical jumps. */
export class ElectricPreviewEngine {
  private cfg: ElectricPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nodes: {
    master: GainNode;
    osc: OscillatorNode;
    env: GainNode;
    bands: BiquadFilterNode[];
    kickBus: GainNode;
  } | null = null;
  private startTime = 0;
  private nextControl = 0;
  private nextBeat = 0;
  private held = 60;

  constructor(cfg: ElectricPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: ElectricPreviewConfig): void {
    this.cfg = cfg;
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const ratio = formantRatio(cfg.formant);
    n.bands.forEach((b, i) => b.frequency.setTargetAtTime(FORMANTS[i]![0] * ratio, ctx.currentTime, 0.03));
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const env = ctx.createGain();
    env.gain.value = 0;
    env.connect(master);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const ratio = formantRatio(this.cfg.formant);
    const bands = FORMANTS.map(([hz, , gain]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz * ratio;
      bp.Q.value = 7;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(bp).connect(g).connect(env);
      return bp;
    });
    const kickBus = ctx.createGain();
    kickBus.connect(master);
    this.nodes = { master, osc, env, bands, kickBus };
    this.startTime = ctx.currentTime + 0.05;
    this.nextControl = this.startTime;
    this.nextBeat = this.startTime;
    this.held = 60;
    osc.frequency.setValueAtTime(midiHz(60), this.startTime);
    osc.start(this.startTime);
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
        nodes.osc.stop();
        nodes.master.disconnect();
      }, 200);
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
    const n = this.nodes;
    if (!ctx || !n) return;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD_SEC;
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    const notes = scaleNotes(this.cfg.scale);
    const shift = Math.max(0, Math.min(24, Math.round(this.cfg.shift))) - 12;
    const threshold = electricThreshold(this.cfg.stability);
    const glide = electricGlideSec(this.cfg.speed);
    while (this.nextControl < horizon) {
      const t = this.nextControl;
      const elapsed = t - this.startTime;
      const { pitch, noteStart } = naturalPitch(elapsed / eighthSec, eighthSec, elapsed);
      const sung = pitch + shift;
      const candidate = nearestScaleNote(sung, notes);
      if (candidate !== this.held && Math.abs(sung - this.held) > threshold) this.held = candidate;
      n.osc.frequency.setTargetAtTime(midiHz(this.held), t, glide);
      if (noteStart) {
        n.env.gain.setTargetAtTime(0.12, t, 0.01);
        n.env.gain.setTargetAtTime(0.55, t + 0.02, 0.02);
      } else if (elapsed < CONTROL_SEC) {
        n.env.gain.setTargetAtTime(0.55, t, 0.02);
      }
      this.nextControl += CONTROL_SEC;
    }
    while (this.nextBeat < horizon) {
      this.kick(this.nextBeat);
      this.nextBeat += eighthSec * 2;
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, 0.07);
    osc.connect(g).connect(this.nodes!.kickBus);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
