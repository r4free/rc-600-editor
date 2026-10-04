export interface WarpPreviewConfig {
  bpm: number;
  /** LEVEL 0–100: effect volume. */
  level: number;
}

/** LEVEL 0–100 → effect gain (1 at 50). */
export const warpLevelGain = (level: number) => Math.max(0, Math.min(100, level)) / 50;

/** Bars the effect is on, then off, in each preview cycle. */
export const WARP_ON_BARS = 2;
const CYCLE_BARS = 4;

/** Pitch wobble of the warped voices: LFO rates (Hz) and depths (s of delay swing). */
const WOBBLES: [number, number][] = [
  [0.13, 0.012],
  [0.21, 0.009],
  [0.34, 0.006],
];

const CHORDS = [
  [60, 64, 67, 71],
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 59, 62, 65],
];
const MELODY = [76, null, null, 79, null, 77, null, null, 74, null, 76, null, 72, null, null, null];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.03;

/** Impulse for a long, soft, washed-out tail. */
function warpImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
  }
  return buf;
}

/**
 * Browser-only Warp: a pad and melody; every four bars the effect is on for two, sending the
 * sound through slowly wobbling delays into a long washed-out tail for a dream-like haze.
 */
export class WarpPreviewEngine {
  private cfg: WarpPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nodes: { master: GainNode; input: GainNode; send: GainNode; level: GainNode; lfos: OscillatorNode[] } | null =
    null;
  private nextSixteenth = 0;
  private sixteenth = 0;

  constructor(cfg: WarpPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: WarpPreviewConfig): void {
    this.cfg = cfg;
    const ctx = this.ctx;
    if (ctx && this.nodes) this.nodes.level.gain.setTargetAtTime(warpLevelGain(cfg.level), ctx.currentTime, GLIDE);
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    input.connect(master);
    const send = ctx.createGain();
    send.gain.value = 0;
    input.connect(send);
    const reverb = ctx.createConvolver();
    reverb.buffer = warpImpulse(ctx, 4);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3500;
    const level = ctx.createGain();
    level.gain.value = warpLevelGain(this.cfg.level);
    reverb.connect(tone).connect(level).connect(master);
    const lfos = WOBBLES.map(([rate, swing], i) => {
      const delay = ctx.createDelay(0.2);
      delay.delayTime.value = 0.03 + i * 0.017;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.value = swing;
      lfo.connect(depth).connect(delay.delayTime);
      lfo.start();
      const pan = ctx.createStereoPanner();
      pan.pan.value = [-0.7, 0.7, 0][i]!;
      send.connect(delay).connect(pan).connect(reverb);
      return lfo;
    });
    this.nodes = { master, input, send, level, lfos };
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
        for (const lfo of nodes.lfos) lfo.stop();
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
    if (!ctx || !this.nodes) return;
    const sixteenthSec = 15 / Math.max(20, this.cfg.bpm);
    while (this.nextSixteenth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextSixteenth;
      const i = this.sixteenth % 16;
      const bar = Math.floor(this.sixteenth / 16);
      if (i === 0) {
        const cycleBar = bar % CYCLE_BARS;
        if (cycleBar === 0) this.nodes.send.gain.setTargetAtTime(1, t, 0.15);
        if (cycleBar === WARP_ON_BARS) this.nodes.send.gain.setTargetAtTime(0, t, 0.05);
        this.pad(t, CHORDS[bar % CHORDS.length]!, sixteenthSec * 16);
      }
      const note = MELODY[i];
      if (note != null) this.pluck(t, note, sixteenthSec * 3);
      this.sixteenth++;
      this.nextSixteenth += sixteenthSec;
    }
  }

  private pad(t: number, notes: number[], dur: number): void {
    const ctx = this.ctx!;
    for (const m of notes) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiHz(m);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.08);
      g.gain.setValueAtTime(0.06, t + dur - 0.08);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(g).connect(this.nodes!.input);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private pluck(t: number, midi: number, len: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midiHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(g).connect(this.nodes!.input);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }
}
