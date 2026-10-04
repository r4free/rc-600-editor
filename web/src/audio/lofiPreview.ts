export interface LofiPreviewConfig {
  bpm: number;
  /** Raw Bit Depth: 0 = OFF, 1–31 = 31 bits down to 1 bit. */
  bitDepthRaw: number;
  /** Raw Sample Rate: 0 = OFF, 1–31 = 1/2 down to 1/32. */
  sampleRateRaw: number;
  /** 0 = direct only, 100 = effect only. */
  balance: number;
}

/** Bits kept (0 = no bit reduction). */
export function lofiBits(raw: number): number {
  const v = Math.round(raw);
  return v <= 0 ? 0 : 32 - Math.min(31, v);
}

/** Samples held per output sample (1 = no rate reduction). */
export function lofiHold(raw: number): number {
  const v = Math.round(raw);
  return v <= 0 ? 1 : Math.min(31, v) + 1;
}

/** Rounds a −1…1 sample to `bits` bits (0 = untouched). */
export function quantize(x: number, bits: number): number {
  if (bits <= 0) return x;
  const step = 2 / 2 ** bits;
  return Math.max(-1, Math.min(1, Math.round(x / step) * step));
}

const CRUSHER_SOURCE = `
class LofiCrusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "bits", defaultValue: 0, minValue: 0, maxValue: 31 },
      { name: "hold", defaultValue: 1, minValue: 1, maxValue: 32 },
    ];
  }
  constructor() {
    super();
    this.phase = 0;
    this.held = [0, 0];
  }
  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    const bits = Math.round(params.bits[0]);
    const hold = Math.max(1, Math.round(params.hold[0]));
    const step = bits > 0 ? 2 / Math.pow(2, bits) : 0;
    let endPhase = this.phase;
    for (let ch = 0; ch < output.length; ch++) {
      const src = input[ch] || input[0];
      const out = output[ch];
      if (!src) { out.fill(0); continue; }
      let phase = this.phase;
      let h = this.held[ch] || 0;
      for (let n = 0; n < out.length; n++) {
        if (phase <= 0) {
          h = src[n];
          if (step) h = Math.max(-1, Math.min(1, Math.round(h / step) * step));
          phase += hold;
        }
        phase -= 1;
        out[n] = h;
      }
      this.held[ch] = h;
      endPhase = phase;
    }
    this.phase = endPhase;
    return true;
  }
}
registerProcessor("lofi-crusher", LofiCrusher);
`;

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Fm7 – Bbm7 – Eb – Ab keys voicings, one chord per bar. */
const KEYS_CHORDS: number[][] = [
  [53, 56, 60, 63],
  [46, 58, 61, 65],
  [51, 55, 58, 62],
  [44, 56, 60, 63],
];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const PARAM_GLIDE_SEC = 0.03;

/** Browser-only keys and drums beat through a bit / sample-rate crusher built from the editor's settings. */
export class LofiPreviewEngine {
  private cfg: LofiPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private moduleReady: Promise<void> | null = null;
  private noise: AudioBuffer | null = null;
  private nodes: {
    master: GainNode;
    input: GainNode;
    dry: GainNode;
    wet: GainNode;
    crusher: AudioWorkletNode;
  } | null = null;
  private nextEighth = 0;
  private eighth = 0;
  private startToken = 0;

  constructor(cfg: LofiPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null || this.startToken > 0;
  }

  update(cfg: LofiPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.moduleReady) {
      const url = URL.createObjectURL(new Blob([CRUSHER_SOURCE], { type: "application/javascript" }));
      this.moduleReady = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    }
    const token = ++this.startToken;
    void this.moduleReady.then(() => {
      if (token !== this.startToken) return;
      this.startToken = 0;
      this.buildGraph(ctx);
      this.nextEighth = ctx.currentTime + 0.05;
      this.eighth = 0;
      this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
      this.schedule();
    });
  }

  stop(): void {
    this.startToken = 0;
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

  private buildGraph(ctx: AudioContext): void {
    if (!this.noise) {
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const crusher = new AudioWorkletNode(ctx, "lofi-crusher", { outputChannelCount: [2] });
    input.connect(dry).connect(master);
    input.connect(crusher).connect(wet).connect(master);
    this.nodes = { master, input, dry, wet, crusher };
    this.applySettings();
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    n.crusher.parameters.get("bits")?.setValueAtTime(lofiBits(this.cfg.bitDepthRaw), t);
    n.crusher.parameters.get("hold")?.setValueAtTime(lofiHold(this.cfg.sampleRateRaw), t);
    const b = Math.max(0, Math.min(100, this.cfg.balance)) / 100;
    n.dry.gain.setTargetAtTime(1 - b, t, PARAM_GLIDE_SEC);
    n.wet.gain.setTargetAtTime(b, t, PARAM_GLIDE_SEC);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    while (this.nextEighth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextEighth;
      const pos = this.eighth % 8;
      const bar = Math.floor(this.eighth / 8);
      if (pos === 0 || pos === 5) this.kick(t);
      if (pos === 2 || pos === 6) this.snare(t);
      this.hat(t, pos % 2 === 0 ? 0.18 : 0.1);
      if (pos === 0 || pos === 3) this.chord(t, KEYS_CHORDS[bar % KEYS_CHORDS.length]!, eighthSec * (pos === 0 ? 3 : 5));
      this.eighth++;
      this.nextEighth += eighthSec;
    }
  }

  private env(t: number, peak: number, len: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, len / 4);
    g.connect(this.nodes!.input);
    return g;
  }

  private chord(t: number, notes: number[], len: number): void {
    const ctx = this.ctx!;
    for (const m of notes) {
      const g = this.env(t, 0.07, len * 1.6);
      for (const [mult, level] of [
        [1, 1],
        [2, 0.35],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.frequency.value = midiHz(m) * mult;
        const og = ctx.createGain();
        og.gain.value = level;
        osc.connect(og).connect(g);
        osc.start(t);
        osc.stop(t + len * 2);
      }
    }
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    osc.connect(this.env(t, 0.9, 0.3));
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private noiseHit(t: number, peak: number, len: number, type: BiquadFilterType, freq: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(this.env(t, peak, len));
    src.start(t, Math.random() * 0.5);
    src.stop(t + len * 2);
  }

  private snare(t: number): void {
    this.noiseHit(t, 0.45, 0.18, "bandpass", 1800);
  }

  private hat(t: number, peak: number): void {
    this.noiseHit(t, peak, 0.05, "highpass", 7000);
  }
}
