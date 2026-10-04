export interface EqPreviewConfig {
  bpm: number;
  /** Band gains in dB (−20…+20). */
  lo: number;
  loMid: number;
  hiMid: number;
  high: number;
  /** Overall level in dB (−20…+20). */
  level: number;
  loMidHz: number;
  loMidQ: number;
  hiMidHz: number;
  hiMidQ: number;
}

/** Corner frequencies assumed for the Lo / High shelves (the Parameter Guide does not list them). */
export const EQ_LO_SHELF_HZ = 100;
export const EQ_HIGH_SHELF_HZ = 8000;
const FS = 48000;

/** "800 Hz" / "3.15 kHz" → Hz. */
export function eqLabelHz(label: string | undefined, fallback: number): number {
  const m = label?.match(/^([\d.]+)\s*(k?)Hz$/);
  if (!m) return fallback;
  return parseFloat(m[1]!) * (m[2] ? 1000 : 1);
}

type Coeffs = [number, number, number, number, number, number];

function peaking(hz: number, q: number, db: number): Coeffs {
  const a = 10 ** (db / 40);
  const w = (2 * Math.PI * hz) / FS;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  return [1 + alpha * a, -2 * c, 1 - alpha * a, 1 + alpha / a, -2 * c, 1 - alpha / a];
}

function shelf(hz: number, db: number, high: boolean): Coeffs {
  const a = 10 ** (db / 40);
  const w = (2 * Math.PI * hz) / FS;
  const c = Math.cos(w);
  const beta = 2 * Math.sqrt(a) * (Math.sin(w) / 2) * Math.SQRT2;
  const s = high ? -1 : 1;
  return [
    a * (a + 1 - s * (a - 1) * c + beta),
    2 * s * a * (a - 1 - s * (a + 1) * c),
    a * (a + 1 - s * (a - 1) * c - beta),
    a + 1 + s * (a - 1) * c + beta,
    -2 * s * (a - 1 + s * (a + 1) * c),
    a + 1 + s * (a - 1) * c - beta,
  ];
}

function magnitudeDb([b0, b1, b2, a0, a1, a2]: Coeffs, hz: number): number {
  const w = (2 * Math.PI * hz) / FS;
  const mag = (x0: number, x1: number, x2: number) =>
    (x0 + x1 * Math.cos(w) + x2 * Math.cos(2 * w)) ** 2 + (x1 * Math.sin(w) + x2 * Math.sin(2 * w)) ** 2;
  return 10 * Math.log10(mag(b0, b1, b2) / mag(a0, a1, a2));
}

/** Combined response of the four bands plus Level, in dB, at `hz`. */
export function eqResponseDb(s: Omit<EqPreviewConfig, "bpm">, hz: number): number {
  return (
    magnitudeDb(shelf(EQ_LO_SHELF_HZ, s.lo, false), hz) +
    magnitudeDb(peaking(s.loMidHz, s.loMidQ, s.loMid), hz) +
    magnitudeDb(peaking(s.hiMidHz, s.hiMidQ, s.hiMid), hz) +
    magnitudeDb(shelf(EQ_HIGH_SHELF_HZ, s.high, true), hz) +
    s.level
  );
}

/** Pad chords (MIDI), one per bar. */
const CHORDS = [
  [45, 52, 57, 60, 64],
  [41, 48, 53, 57, 60],
  [43, 50, 55, 59, 62],
  [40, 47, 52, 55, 59],
];
const BASS = [33, 29, 31, 28];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.03;

/** Browser-only EQ: a full-range beat, bass and pad loop through the four EQ bands and Level. */
export class EqPreviewEngine {
  private cfg: EqPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer | null = null;
  private nodes: {
    master: GainNode;
    input: GainNode;
    lo: BiquadFilterNode;
    loMid: BiquadFilterNode;
    hiMid: BiquadFilterNode;
    high: BiquadFilterNode;
    level: GainNode;
  } | null = null;
  private nextSixteenth = 0;
  private sixteenth = 0;

  constructor(cfg: EqPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: EqPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const filter = (type: BiquadFilterType, hz: number) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      return f;
    };
    const lo = filter("lowshelf", EQ_LO_SHELF_HZ);
    const loMid = filter("peaking", 800);
    const hiMid = filter("peaking", 3150);
    const high = filter("highshelf", EQ_HIGH_SHELF_HZ);
    const level = ctx.createGain();
    input.connect(lo).connect(loMid).connect(hiMid).connect(high).connect(level).connect(master);
    this.nodes = { master, input, lo, loMid, hiMid, high, level };
    this.applySettings();
    this.nextSixteenth = ctx.currentTime + 0.05;
    this.sixteenth = 0;
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

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const c = this.cfg;
    n.lo.gain.setTargetAtTime(c.lo, t, GLIDE);
    n.loMid.gain.setTargetAtTime(c.loMid, t, GLIDE);
    n.loMid.frequency.setTargetAtTime(c.loMidHz, t, GLIDE);
    n.loMid.Q.setTargetAtTime(c.loMidQ, t, GLIDE);
    n.hiMid.gain.setTargetAtTime(c.hiMid, t, GLIDE);
    n.hiMid.frequency.setTargetAtTime(c.hiMidHz, t, GLIDE);
    n.hiMid.Q.setTargetAtTime(c.hiMidQ, t, GLIDE);
    n.high.gain.setTargetAtTime(c.high, t, GLIDE);
    n.level.gain.setTargetAtTime(10 ** (c.level / 20), t, GLIDE);
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
    const sixteenthSec = 15 / Math.max(20, this.cfg.bpm);
    while (this.nextSixteenth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextSixteenth;
      const i = this.sixteenth % 16;
      const bar = Math.floor(this.sixteenth / 16);
      if (i === 0) this.pad(t, CHORDS[bar % CHORDS.length]!, sixteenthSec * 16);
      if (i % 4 === 0 || i === 14) this.bass(t, BASS[bar % BASS.length]!, sixteenthSec * 1.8);
      if (i === 0 || i === 8 || i === 10) this.kick(t);
      if (i === 4 || i === 12) this.hit(t, 0.45, 0.16, "bandpass", 1800);
      if (i % 2 === 0) this.hit(t, i % 4 === 2 ? 0.16 : 0.09, 0.05, "highpass", 8000);
      this.sixteenth++;
      this.nextSixteenth += sixteenthSec;
    }
  }

  private pad(t: number, notes: number[], dur: number): void {
    const ctx = this.ctx!;
    for (const m of notes) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiHz(m + 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.04);
      g.gain.setValueAtTime(0.035, t + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(g).connect(this.nodes!.input);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private bass(t: number, midi: number, len: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = midiHz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(lp).connect(g).connect(this.nodes!.input);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.nodes!.input);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private hit(t: number, peak: number, len: number, type: BiquadFilterType, hz: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(this.nodes!.input);
    src.start(t);
    src.stop(t + len + 0.02);
  }
}
