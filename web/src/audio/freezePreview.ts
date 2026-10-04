export interface FreezePreviewConfig {
  bpm: number;
  /** ATTACK 0–100: fade time until the frozen sound is output. */
  attack: number;
  /** RELEASE 0–100: fade time over which the frozen sound disappears. */
  release: number;
  /** DECAY 0–100: time for the frozen sound to settle to the sustain level. */
  decay: number;
  /** SUSTAIN 0–100: level the frozen sound holds at. */
  sustain: number;
  /** BALANCE 0–100: direct sound (0) ↔ frozen sound (100). */
  balance: number;
}

/** ATTACK / RELEASE / DECAY 0–100 → seconds (20 ms – 3 s, logarithmic). */
export function freezeTimeSec(v: number): number {
  return 0.02 * 150 ** (Math.max(0, Math.min(100, v)) / 100);
}

/** SUSTAIN 0–100 → level the frozen sound holds at, relative to its peak (0.2 – 1). */
export function freezeSustainLevel(v: number): number {
  return 0.2 + (Math.max(0, Math.min(100, v)) / 100) * 0.8;
}

/** BALANCE 0–100 → [direct, effect] gains; both at full in the middle. */
export function freezeMix(balance: number): [number, number] {
  const b = Math.max(0, Math.min(100, balance)) / 100;
  return [Math.min(1, 2 * (1 - b)), Math.min(1, 2 * b)];
}

/** Bars the freeze is held on, then off, in each preview cycle. */
export const FREEZE_ON_BARS = 2;
const CYCLE_BARS = 4;

/** Chord frozen at the start of each cycle (MIDI), and the melody that keeps playing over it. */
const CHORDS = [
  [57, 60, 64, 69],
  [53, 57, 60, 65],
];
const MELODY = [76, 74, 72, 69, 72, 74, 76, 79, 77, 76, 74, 72, 74, 72, 69, 67];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.03;
const DETUNE_CENTS = [-7, 0, 6];

/**
 * Browser-only Freeze: every 4 bars a chord is struck and frozen for 2 bars (the held copy fades in
 * over Attack, settles to Sustain over Decay), then released (fades over Release) while a melody keeps
 * playing on top, so the frozen drone and the live sound can be heard together.
 */
export class FreezePreviewEngine {
  private cfg: FreezePreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nodes: { master: GainNode; dry: GainNode; wet: GainNode } | null = null;
  private held: { oscs: OscillatorNode[]; env: GainNode } | null = null;
  private nextEighth = 0;
  private eighth = 0;

  constructor(cfg: FreezePreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: FreezePreviewConfig): void {
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
    const wet = ctx.createGain();
    dry.connect(master);
    wet.connect(master);
    this.nodes = { master, dry, wet };
    this.applyMix();
    this.nextEighth = ctx.currentTime + 0.05;
    this.eighth = 0;
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    const nodes = this.nodes;
    const held = this.held;
    if (ctx && nodes) {
      nodes.master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(() => {
        held?.oscs.forEach((o) => o.stop());
        nodes.master.disconnect();
      }, 200);
    }
    this.nodes = null;
    this.held = null;
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private applyMix(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const [dry, wet] = freezeMix(this.cfg.balance);
    n.dry.gain.setTargetAtTime(dry, ctx.currentTime, GLIDE);
    n.wet.gain.setTargetAtTime(wet, ctx.currentTime, GLIDE);
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
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    while (this.nextEighth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextEighth;
      const i = this.eighth % 8;
      const bar = Math.floor(this.eighth / 8);
      const cycleBar = bar % CYCLE_BARS;
      if (i === 0 && cycleBar === 0) {
        const chord = CHORDS[Math.floor(bar / CYCLE_BARS) % CHORDS.length]!;
        for (const m of chord) this.pluck(t, m, 0.12, 1.4);
        this.freezeOn(t, chord);
      }
      if (i === 0 && cycleBar === FREEZE_ON_BARS) this.freezeOff(t);
      if (cycleBar !== 0 || i >= 2) this.pluck(t, MELODY[this.eighth % MELODY.length]!, 0.1, 0.35);
      this.eighth++;
      this.nextEighth += eighthSec;
    }
  }

  private freezeOn(t: number, chord: number[]): void {
    const ctx = this.ctx!;
    this.freezeOff(t);
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    env.connect(this.nodes!.wet);
    lp.connect(env);
    const oscs: OscillatorNode[] = [];
    for (const m of chord) {
      for (const cents of DETUNE_CENTS) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midiHz(m);
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = 0.025;
        osc.connect(g).connect(lp);
        osc.start(t);
        oscs.push(osc);
      }
    }
    const attack = freezeTimeSec(this.cfg.attack);
    const decay = freezeTimeSec(this.cfg.decay);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + attack);
    env.gain.setTargetAtTime(freezeSustainLevel(this.cfg.sustain), t + attack, decay / 3);
    this.held = { oscs, env };
  }

  private freezeOff(t: number): void {
    const held = this.held;
    if (!held) return;
    this.held = null;
    const release = freezeTimeSec(this.cfg.release);
    const p = held.env.gain;
    if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(t);
    else p.cancelScheduledValues(t);
    p.setTargetAtTime(0, t, release / 4);
    for (const o of held.oscs) o.stop(t + release + 0.1);
  }

  private pluck(t: number, midi: number, peak: number, len: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midiHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(g).connect(this.nodes!.dry);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }
}
