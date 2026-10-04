export interface TwistPreviewConfig {
  bpm: number;
  /** RELEASE: 0 = FALL (stops at once), 1 = FADE (fades out while still rotating). */
  release: number;
  /** RISE 0–100: time to reach full rotation. */
  rise: number;
  /** FALL 0–100: fade-out time with RELEASE FADE. */
  fall: number;
  /** LEVEL 0–100: effect volume. */
  level: number;
}

/** RISE 0–100 → seconds to reach full rotation (0.1 s – 4 s). */
export function twistRiseSec(rise: number): number {
  return 0.1 * 40 ** (Math.max(0, Math.min(100, rise)) / 100);
}

/** FALL 0–100 → fade-out seconds with RELEASE FADE (0.1 s – 4 s). */
export const twistFallSec = twistRiseSec;

/** Rotation speed (Hz) at the start and at full twist. */
export const TWIST_RATE_HZ: [number, number] = [0.4, 14];

/** Bars the effect is held on, then off, in each preview cycle. */
export const TWIST_ON_BARS = 2;
const CYCLE_BARS = 4;

/** Pad chords (MIDI), one per bar. */
const CHORDS = [
  [48, 55, 60, 64],
  [45, 52, 57, 60],
  [41, 48, 53, 57],
  [43, 50, 55, 59],
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.03;

/**
 * Browser-only Twist: a beat and pad loop; every 4 bars the effect is switched on for 2 bars
 * (the rotation speeds up over Rise) and then off (Fall stops it, Fade lets it fade while spinning).
 */
export class TwistPreviewEngine {
  private cfg: TwistPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer | null = null;
  private nodes: {
    master: GainNode;
    input: GainNode;
    lfo: OscillatorNode;
    depth: GainNode;
    wet: GainNode;
    level: GainNode;
  } | null = null;
  private nextSixteenth = 0;
  private sixteenth = 0;

  constructor(cfg: TwistPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: TwistPreviewConfig): void {
    this.cfg = cfg;
    const ctx = this.ctx;
    if (ctx && this.nodes) this.nodes.level.gain.setTargetAtTime(this.levelGain(), ctx.currentTime, GLIDE);
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
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const dry = ctx.createGain();
    input.connect(dry).connect(master);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = TWIST_RATE_HZ[0];
    const depth = ctx.createGain();
    depth.gain.value = 0;
    lfo.connect(depth);
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.006;
    depth.connect(delay.delayTime);
    const panner = ctx.createStereoPanner();
    const panDepth = ctx.createGain();
    panDepth.gain.value = 0.9;
    lfo.connect(panDepth).connect(panner.pan);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.55;
    delay.connect(feedback).connect(delay);
    const wet = ctx.createGain();
    wet.gain.value = 0;
    const level = ctx.createGain();
    level.gain.value = this.levelGain();
    input.connect(delay).connect(panner).connect(wet).connect(level).connect(master);
    lfo.start();

    this.nodes = { master, input, lfo, depth, wet, level };
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
      setTimeout(() => {
        nodes.lfo.stop();
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

  private levelGain(): number {
    return (Math.max(0, Math.min(100, this.cfg.level)) / 50) * 1.2;
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
      if (i === 0) {
        const cycleBar = bar % CYCLE_BARS;
        if (cycleBar === 0) this.twistOn(t);
        if (cycleBar === TWIST_ON_BARS) this.twistOff(t);
        this.pad(t, CHORDS[bar % CHORDS.length]!, sixteenthSec * 16);
      }
      if (i === 0 || i === 8 || i === 10) this.kick(t);
      if (i === 4 || i === 12) this.hit(t, 0.4, 0.15, "bandpass", 1800);
      if (i % 2 === 0) this.hit(t, i % 4 === 2 ? 0.14 : 0.08, 0.04, "highpass", 7000);
      this.sixteenth++;
      this.nextSixteenth += sixteenthSec;
    }
  }

  private twistOn(t: number): void {
    const n = this.nodes!;
    const rise = twistRiseSec(this.cfg.rise);
    for (const p of [n.lfo.frequency, n.depth.gain, n.wet.gain]) p.cancelScheduledValues(t);
    n.lfo.frequency.setValueAtTime(TWIST_RATE_HZ[0], t);
    n.lfo.frequency.exponentialRampToValueAtTime(TWIST_RATE_HZ[1], t + rise);
    n.depth.gain.setValueAtTime(0, t);
    n.depth.gain.linearRampToValueAtTime(0.004, t + rise);
    n.wet.gain.setValueAtTime(0, t);
    n.wet.gain.linearRampToValueAtTime(1, t + Math.min(rise, 0.3));
  }

  private twistOff(t: number): void {
    const n = this.nodes!;
    for (const p of [n.lfo.frequency, n.depth.gain, n.wet.gain]) {
      if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(t);
      else p.cancelScheduledValues(t);
    }
    if (this.cfg.release === 1) {
      n.wet.gain.linearRampToValueAtTime(0, t + twistFallSec(this.cfg.fall));
    } else {
      n.wet.gain.setValueAtTime(1, t);
      n.wet.gain.linearRampToValueAtTime(0, t + 0.03);
      n.lfo.frequency.setValueAtTime(TWIST_RATE_HZ[0], t + 0.03);
      n.depth.gain.setValueAtTime(0, t + 0.03);
    }
  }

  private pad(t: number, notes: number[], dur: number): void {
    const ctx = this.ctx!;
    for (const m of notes) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiHz(m);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.05);
      g.gain.setValueAtTime(0.05, t + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(lp).connect(g).connect(this.nodes!.input);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(this.nodes!.input);
    osc.start(t);
    osc.stop(t + 0.3);
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
