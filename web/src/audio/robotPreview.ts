export interface RobotPreviewConfig {
  bpm: number;
  /** NOTE 0–11 (C–B): the fixed pitch of the robot voice. */
  note: number;
  /** Raw FORMANT 0–100 (−50…+50): masculine ↔ feminine. */
  formant: number;
  /** 0 = MODE 1 (previous RC series), 1 = MODE 2 (new algorithm). */
  mode: number;
}

/** Robot NOTE as a MIDI pitch, C3–B3. */
export const robotMidi = (note: number) => 48 + Math.max(0, Math.min(11, Math.round(note)));

/** FORMANT −50…+50 as a formant frequency ratio (about 0.71× to 1.41×, 1 at 0). */
export function formantRatio(raw: number): number {
  const f = Math.max(0, Math.min(100, raw)) - 50;
  return 2 ** (f / 100);
}

/** "ah", "ee", "oh", "oo", "eh" formants (Hz). */
const VOWELS: [number, number, number][] = [
  [730, 1090, 2440],
  [270, 2290, 3010],
  [570, 840, 2410],
  [300, 870, 2240],
  [530, 1840, 2480],
];
/** Syllables of the sung phrase: vowel and length in eighths (the melody's pitch is ignored). */
const SYLLABLES: { vowel: number; eighths: number }[] = [
  { vowel: 0, eighths: 1 },
  { vowel: 1, eighths: 1 },
  { vowel: 2, eighths: 2 },
  { vowel: 4, eighths: 1 },
  { vowel: 3, eighths: 1 },
  { vowel: 0, eighths: 2 },
  { vowel: 1, eighths: 1 },
  { vowel: 2, eighths: 1 },
  { vowel: 4, eighths: 1 },
  { vowel: 0, eighths: 1 },
  { vowel: 3, eighths: 4 },
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

/** Browser-only robot voice: sung syllables locked to one fixed pitch, with light drums for timing. */
export class RobotPreviewEngine {
  private cfg: RobotPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private master: GainNode | null = null;
  private nextEighth = 0;
  private eighth = 0;
  private syllable = 0;
  private left = 0;

  constructor(cfg: RobotPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: RobotPreviewConfig): void {
    this.cfg = cfg;
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    this.master = master;
    this.nextEighth = ctx.currentTime + 0.05;
    this.eighth = 0;
    this.syllable = 0;
    this.left = 0;
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

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    while (this.nextEighth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextEighth;
      const pos = this.eighth % 8;
      if (pos === 0 || pos === 4) this.kick(t);
      if (this.left <= 0) {
        const s = SYLLABLES[this.syllable % SYLLABLES.length]!;
        this.voice(t, s.eighths * eighthSec, VOWELS[s.vowel]!);
        this.left = s.eighths;
        this.syllable++;
      }
      this.left--;
      this.eighth++;
      this.nextEighth += eighthSec;
    }
  }

  private voice(t: number, dur: number, vowel: [number, number, number]): void {
    const ctx = this.ctx!;
    const classic = this.cfg.mode === 0;
    const hz = midiHz(robotMidi(this.cfg.note));
    const ratio = formantRatio(this.cfg.formant);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(classic ? 0.6 : 0.5, t + (classic ? 0.005 : 0.025));
    env.gain.setValueAtTime(classic ? 0.6 : 0.5, t + dur * 0.8);
    env.gain.linearRampToValueAtTime(0, t + dur * 0.95);
    env.connect(this.master!);

    const sources: OscillatorNode[] = [];
    const carrier = ctx.createGain();
    for (const [type, mult, level] of (classic
      ? [
          ["square", 1, 0.5],
          ["sawtooth", 1, 0.5],
        ]
      : [
          ["sawtooth", 1, 0.7],
          ["sawtooth", 1.003, 0.3],
        ]) as [OscillatorType, number, number][]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz * mult;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(carrier);
      sources.push(osc);
    }

    vowel.forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f * ratio;
      bp.Q.value = classic ? 14 : 8;
      const g = ctx.createGain();
      g.gain.value = [2.6, 1.8, 1][i]!;
      carrier.connect(bp).connect(g).connect(env);
    });

    for (const osc of sources) {
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, 0.07);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
