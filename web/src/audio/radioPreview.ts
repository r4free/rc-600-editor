export interface RadioPreviewConfig {
  bpm: number;
  /** LO-FI 1–10: amount of blurring. */
  lofi: number;
  /** LEVEL 0–100: volume of the effect sound (50 = same loudness). */
  level: number;
}

export interface RadioBand {
  lowHz: number;
  highHz: number;
  /** Saturation amount (1 = clean). */
  drive: number;
  /** Hiss level relative to the effect sound. */
  noise: number;
}

/** Passband, saturation and hiss for LO-FI 1–10: higher values narrow the band and blur the sound. */
export function radioBand(lofi: number): RadioBand {
  const t = (Math.max(1, Math.min(10, Math.round(lofi))) - 1) / 9;
  return {
    lowHz: Math.round(200 * (900 / 200) ** t),
    highHz: Math.round(6000 * (1500 / 6000) ** t),
    drive: 1 + t * 6,
    noise: 0.015 + t * 0.06,
  };
}

/** LEVEL as a gain: 50 = unity, 100 = +6 dB. */
export const radioLevelGain = (level: number) => Math.max(0, Math.min(100, level)) / 50;

/** Sung melody in eighth notes (null = hold / rest handled by length). */
const VOICE: { midi: number; eighths: number }[] = [
  { midi: 64, eighths: 2 },
  { midi: 67, eighths: 1 },
  { midi: 69, eighths: 1 },
  { midi: 67, eighths: 2 },
  { midi: 64, eighths: 2 },
  { midi: 62, eighths: 2 },
  { midi: 64, eighths: 1 },
  { midi: 67, eighths: 1 },
  { midi: 64, eighths: 4 },
];
/** "ah", "oh", "ee" formants (Hz). */
const VOWELS: [number, number][] = [
  [750, 1200],
  [500, 900],
  [320, 2300],
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.04;

function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

/** Browser-only radio voice: a sung melody and light drums through a narrow, saturated band with hiss. */
export class RadioPreviewEngine {
  private cfg: RadioPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private nodes: {
    master: GainNode;
    input: GainNode;
    hp: BiquadFilterNode[];
    lp: BiquadFilterNode[];
    shaper: WaveShaperNode;
    level: GainNode;
    hiss: GainNode;
    hissSrc: AudioBufferSourceNode;
  } | null = null;
  private appliedDrive = 0;
  private nextEighth = 0;
  private eighth = 0;
  private noteIndex = 0;
  private noteLeft = 0;

  constructor(cfg: RadioPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: RadioPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.noiseBuf) {
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const hp = [0, 1].map(() => {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.Q.value = 0.8;
      return f;
    });
    const lp = [0, 1].map(() => {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 0.9;
      return f;
    });
    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 1500;
    presence.Q.value = 1;
    presence.gain.value = 5;
    const shaper = ctx.createWaveShaper();
    shaper.oversample = "2x";
    const level = ctx.createGain();
    input.connect(hp[0]!).connect(hp[1]!).connect(presence).connect(shaper).connect(lp[0]!).connect(lp[1]!);
    lp[1]!.connect(level).connect(master);

    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = this.noiseBuf;
    hissSrc.loop = true;
    const hissBand = ctx.createBiquadFilter();
    hissBand.type = "bandpass";
    hissBand.frequency.value = 2500;
    hissBand.Q.value = 0.6;
    const hiss = ctx.createGain();
    hissSrc.connect(hissBand).connect(hiss).connect(level);
    hissSrc.start();

    this.nodes = { master, input, hp, lp, shaper, level, hiss, hissSrc };
    this.appliedDrive = 0;
    this.applySettings();
    this.nextEighth = ctx.currentTime + 0.05;
    this.eighth = 0;
    this.noteIndex = 0;
    this.noteLeft = 0;
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
        nodes.hissSrc.stop();
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

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const band = radioBand(this.cfg.lofi);
    for (const f of n.hp) f.frequency.setTargetAtTime(band.lowHz, t, GLIDE);
    for (const f of n.lp) f.frequency.setTargetAtTime(band.highHz, t, GLIDE);
    if (band.drive !== this.appliedDrive) {
      n.shaper.curve = driveCurve(band.drive);
      this.appliedDrive = band.drive;
    }
    n.hiss.gain.setTargetAtTime(band.noise, t, GLIDE);
    n.level.gain.setTargetAtTime(radioLevelGain(this.cfg.level), t, GLIDE);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    while (this.nextEighth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextEighth;
      const pos = this.eighth % 8;
      if (pos === 0 || pos === 5) this.kick(t);
      if (pos === 2 || pos === 6) this.snare(t);
      if (this.noteLeft <= 0) {
        const note = VOICE[this.noteIndex % VOICE.length]!;
        this.sing(t, note.midi, note.eighths * eighthSec, VOWELS[this.noteIndex % VOWELS.length]!);
        this.noteLeft = note.eighths;
        this.noteIndex++;
      }
      this.noteLeft--;
      this.eighth++;
      this.nextEighth += eighthSec;
    }
  }

  private sing(t: number, midi: number, dur: number, formants: [number, number]): void {
    const ctx = this.ctx!;
    const n = this.nodes!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.04);
    env.gain.setTargetAtTime(0, t + dur * 0.9, 0.04);
    env.connect(n.input);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiHz(midi);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = midiHz(midi) * 0.012;
    vib.connect(vibDepth).connect(osc.frequency);

    for (const [hz, gain] of [
      [formants[0], 1],
      [formants[1], 0.6],
    ] as const) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = hz;
      f.Q.value = 6;
      const g = ctx.createGain();
      g.gain.value = gain * 2.2;
      osc.connect(f).connect(g).connect(env);
    }
    const end = t + dur + 0.3;
    osc.start(t);
    vib.start(t);
    osc.stop(end);
    vib.stop(end);
  }

  private hit(t: number, peak: number, len: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, len / 4);
    g.connect(this.nodes!.input);
    return g;
  }

  private kick(t: number): void {
    const osc = this.ctx!.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    osc.connect(this.hit(t, 0.7, 0.3));
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private snare(t: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    src.connect(f).connect(this.hit(t, 0.35, 0.18));
    src.start(t, Math.random());
    src.stop(t + 0.4);
  }
}
