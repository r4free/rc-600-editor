import { pluckString } from "./chorusPreview";
import { stepDurationSec } from "./stepPreview";

export interface AutoRiffPreviewConfig {
  bpm: number;
  /** 0–29 (P1–P30). */
  phrase: number;
  rateIndex: number;
  hold: boolean;
  /** 0–100: loudness of the attack added to each riff note. */
  attack: number;
  loop: boolean;
  /** 0–11: C (Am) … B (G#m). */
  key: number;
  /** 0–100: direct → riff. */
  balance: number;
}

export type PhraseToken = number | "-" | ".";

/**
 * Preview phrases for P1–P30, 16 steps each. Numbers are scale steps above the note you
 * play (0 = that note, 7 = an octave up, negatives go below), `-` holds the previous note
 * and `.` is a rest. The RC-600's own phrases are not published; these only give each
 * number a distinct riff.
 */
const PHRASE_SOURCE = [
  "0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
  "0 - 4 - 7 - 4 - 0 - 4 - 7 - 4 -",
  "0 2 4 7 4 2 0 2 4 7 4 2 0 2 4 7",
  "7 6 5 4 3 2 1 0 7 6 5 4 3 2 1 0",
  "0 0 4 0 0 4 0 4 0 0 4 0 0 4 2 1",
  "0 . 0 . 4 . 4 . 5 . 5 . 4 - - .",
  "0 2 1 3 2 4 3 5 4 6 5 7 6 4 2 0",
  "0 7 0 7 0 7 0 7 2 9 2 9 4 11 4 11",
  "0 - - 2 - - 4 - - 2 - - 0 - 1 -",
  "4 3 2 0 4 3 2 0 4 3 2 0 2 1 0 -",
  "0 . 2 4 . 2 0 . 0 . 2 4 . 2 0 .",
  "0 4 7 9 7 4 0 4 7 9 7 4 0 4 7 9",
  "0 1 0 -1 0 1 2 1 0 1 0 -1 -3 -2 -1 0",
  "-3 0 2 4 2 0 -3 0 2 4 2 0 -3 0 2 4",
  "7 - 4 - 2 - 0 - 7 - 4 - 2 - 0 -",
  "0 0 0 . 0 0 0 . 2 2 2 . 1 1 1 .",
  "0 2 4 6 7 6 4 2 0 2 4 6 7 6 4 2",
  "0 . . 0 . . 0 . 4 . . 4 . . 2 .",
  "0 4 2 4 0 4 2 4 1 4 2 4 1 4 2 4",
  "0 2 4 2 5 4 2 4 3 2 1 2 0 - - -",
  "4 4 2 0 4 4 2 0 5 5 4 2 4 - - -",
  "0 7 4 2 0 7 4 2 0 7 4 2 0 7 4 2",
  "0 1 2 4 5 7 5 4 2 1 0 -3 -2 -1 0 -",
  "0 - 2 - 0 - -1 - 0 - 2 - 4 - 2 -",
  "7 . 7 4 . 4 2 . 2 0 . 0 2 . 4 .",
  "0 2 0 4 0 5 0 4 0 2 0 4 0 7 0 4",
  "0 0 2 2 4 4 7 7 4 4 2 2 0 0 -3 -3",
  "0 4 7 11 7 4 0 4 7 11 7 4 0 4 7 4",
  "0 . 2 . 4 . 5 . 7 . 5 . 4 . 2 .",
  "0 3 4 7 4 3 0 3 4 7 4 3 0 3 4 -",
];

export const RIFF_PHRASES: PhraseToken[][] = PHRASE_SOURCE.map((src) =>
  src.split(" ").map((t) => (t === "-" || t === "." ? t : Number(t))),
);

export const PHRASE_STEPS = 16;

export interface PhraseNote {
  start: number;
  length: number;
  degree: number;
}

/** Notes of a phrase with held steps merged into the note before them. */
export function phraseNotes(phrase: number): PhraseNote[] {
  const tokens = RIFF_PHRASES[Math.max(0, Math.min(RIFF_PHRASES.length - 1, phrase))]!;
  const notes: PhraseNote[] = [];
  tokens.forEach((t, i) => {
    if (typeof t === "number") notes.push({ start: i, length: 1, degree: t });
    else if (t === "-" && notes.length && notes.at(-1)!.start + notes.at(-1)!.length === i) notes.at(-1)!.length++;
  });
  return notes;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** MIDI note `degree` scale steps above scale step `played` of the major key `tonic`. */
export function scaleMidi(tonic: number, played: number, degree: number): number {
  const s = played + degree;
  const octave = Math.floor(s / 7);
  return tonic + octave * 12 + MAJOR[((s % 7) + 7) % 7]!;
}

/** I – vi – IV – V, as scale steps of the key. */
const PROGRESSION = [0, 5, 3, 4];
const PERIOD_BEATS = 8;
const INPUT_BEATS = 4;

export const riffStepEvents = new EventTarget();

function emitStep(step: number | null): void {
  riffStepEvents.dispatchEvent(new CustomEvent<number | null>("step", { detail: step }));
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

/**
 * Browser-only Auto Riff: a guitar note every two bars (I – vi – IV – V) and a synth riff
 * that follows the phrase from that note, with Tempo, Key, Hold, Loop, Attack and Balance.
 */
export class AutoRiffPreviewEngine {
  private cfg: AutoRiffPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nodes: { master: GainNode; dry: GainNode; wet: GainNode; tone: BiquadFilterNode } | null = null;
  private periodStart = 0;
  private period = 0;
  private step = 0;
  private stepTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(cfg: AutoRiffPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: AutoRiffPreviewConfig): void {
    this.cfg = cfg;
    this.applyMix();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    const dry = ctx.createGain();
    dry.connect(master);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    tone.Q.value = 0.8;
    const wet = ctx.createGain();
    tone.connect(wet).connect(master);
    this.nodes = { master, dry, wet, tone };
    this.applyMix();
    this.periodStart = ctx.currentTime + 0.05;
    this.period = 0;
    this.step = 0;
    this.startPeriod();
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stepTimers.forEach(clearTimeout);
    this.stepTimers = [];
    emitStep(null);
    const ctx = this.ctx;
    const nodes = this.nodes;
    if (ctx && nodes) {
      nodes.master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(() => nodes.master.disconnect(), 250);
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
    const b = Math.max(0, Math.min(100, this.cfg.balance)) / 100;
    n.dry.gain.setTargetAtTime(Math.cos((b * Math.PI) / 2), ctx.currentTime, 0.03);
    n.wet.gain.setTargetAtTime(Math.sin((b * Math.PI) / 2), ctx.currentTime, 0.03);
  }

  private beatSec(): number {
    return 60 / Math.max(20, this.cfg.bpm);
  }

  private playedStep(): number {
    return PROGRESSION[this.period % PROGRESSION.length]!;
  }

  private tonic(): number {
    return 48 + Math.max(0, Math.min(11, this.cfg.key));
  }

  /** Plucks the "played" guitar note that the riff is built from. */
  private startPeriod(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = this.periodStart;
    const inputSec = this.beatSec() * INPUT_BEATS;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.round(sr * (inputSec + 0.1)), sr);
    pluckString(buf.getChannelData(0), sr, midiHz(scaleMidi(this.tonic(), this.playedStep(), 0)), 0, 0.5);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.setTargetAtTime(0, t + inputSec, 0.03);
    src.connect(env).connect(n.dry);
    src.start(t);
    src.stop(t + inputSec + 0.1);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD_SEC;
    for (;;) {
      const beat = this.beatSec();
      const periodSec = beat * PERIOD_BEATS;
      const stepSec = Math.max(0.04, stepDurationSec(this.cfg.rateIndex, this.cfg.bpm));
      const t = this.periodStart + this.step * stepSec;
      if (t >= this.periodStart + periodSec) {
        if (this.periodStart + periodSec >= horizon) return;
        this.periodStart += periodSec;
        this.period++;
        this.step = 0;
        this.startPeriod();
        continue;
      }
      if (t >= horizon) return;
      this.playStep(t, stepSec, this.periodStart + periodSec, this.periodStart + beat * INPUT_BEATS);
      this.step++;
    }
  }

  private playStep(t: number, stepSec: number, periodEnd: number, inputEnd: number): void {
    const { loop, hold, phrase } = this.cfg;
    const pos = loop ? this.step % PHRASE_STEPS : this.step;
    const audible = pos < PHRASE_STEPS && (hold || t < inputEnd);
    this.emitAt(t, audible ? pos : null);
    if (!audible) return;
    const note = phraseNotes(phrase).find((p) => p.start === pos);
    if (!note) return;
    const end = Math.min(t + note.length * stepSec, periodEnd, hold ? periodEnd : inputEnd);
    this.riffNote(t, end - t, scaleMidi(this.tonic(), this.playedStep(), note.degree) + 12);
  }

  private riffNote(t: number, dur: number, midi: number): void {
    const ctx = this.ctx!;
    const n = this.nodes!;
    const a = Math.max(0, Math.min(100, this.cfg.attack)) / 100;
    const ramp = 0.002 + (1 - a) * 0.04;
    const peak = 0.12 + a * 0.16;
    const sustain = 0.12;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + ramp);
    env.gain.setTargetAtTime(sustain, t + ramp, 0.05);
    env.gain.setTargetAtTime(0, t + Math.max(ramp, dur - 0.02), 0.015);
    env.connect(n.tone);
    const hz = midiHz(midi);
    for (const [type, detune] of [
      ["sawtooth", -5],
      ["square", 5],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz;
      osc.detune.value = detune;
      osc.connect(env);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    }
  }

  private emitAt(t: number, step: number | null): void {
    const ctx = this.ctx!;
    const delay = Math.max(0, (t - ctx.currentTime) * 1000);
    const id = setTimeout(() => {
      this.stepTimers = this.stepTimers.filter((x) => x !== id);
      if (this.playing) emitStep(step);
    }, delay);
    this.stepTimers.push(id);
  }
}
