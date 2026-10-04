import { GUITAR_PROGRESSION, pluckString } from "./chorusPreview";

export interface PreampPreviewConfig {
  bpm: number;
  ampType: number;
  speakerType: number;
  gain: number;
  tComp: number;
  bass: number;
  middle: number;
  treble: number;
  presence: number;
  micType: number;
  micDistance: number;
  micPosition: number;
  effectLevel: number;
}

type AmpVoice = {
  drive: number;
  low: number;
  mid: number;
  high: number;
  lowCut: number;
  highCut: number;
};

const AMP_VOICES: AmpVoice[] = [
  { drive: 0.14, low: -1, mid: -1, high: 2, lowCut: 65, highCut: 10500 },
  { drive: 0.1, low: 1, mid: 0, high: 1, lowCut: 55, highCut: 12000 },
  { drive: 0.08, low: 0, mid: 0, high: 0, lowCut: 35, highCut: 16000 },
  { drive: 0.32, low: 2, mid: 2, high: 0, lowCut: 70, highCut: 8500 },
  { drive: 0.48, low: 3, mid: 1, high: 1, lowCut: 75, highCut: 7600 },
  { drive: 0.68, low: 2, mid: -2, high: 2, lowCut: 80, highCut: 7000 },
  { drive: 0.56, low: 1, mid: 3, high: 1, lowCut: 70, highCut: 8200 },
  { drive: 0.78, low: 1, mid: 2, high: 3, lowCut: 90, highCut: 6500 },
  { drive: 0.9, low: 4, mid: -4, high: 3, lowCut: 95, highCut: 6000 },
];

type CabinetVoice = { lowCut: number; highCut: number; bodyHz: number; bodyDb: number };
const CABINETS: CabinetVoice[] = [
  { lowCut: 25, highCut: 18000, bodyHz: 800, bodyDb: 0 },
  { lowCut: 70, highCut: 7200, bodyHz: 950, bodyDb: 2 },
  { lowCut: 115, highCut: 6500, bodyHz: 1150, bodyDb: 1 },
  { lowCut: 100, highCut: 7000, bodyHz: 1050, bodyDb: 1.5 },
  { lowCut: 85, highCut: 6800, bodyHz: 900, bodyDb: 2 },
  { lowCut: 70, highCut: 6400, bodyHz: 780, bodyDb: 2.5 },
  { lowCut: 62, highCut: 7600, bodyHz: 900, bodyDb: 1.5 },
  { lowCut: 55, highCut: 6100, bodyHz: 680, bodyDb: 3 },
  { lowCut: 45, highCut: 5700, bodyHz: 560, bodyDb: 3.5 },
];

type MicVoice = { low: number; presence: number; air: number };
const MICROPHONES: MicVoice[] = [
  { low: -1, presence: 3, air: -2 },
  { low: 2, presence: 1, air: -2 },
  { low: -2, presence: 2, air: 3 },
  { low: 1, presence: 1, air: 2 },
  { low: 0, presence: 0, air: 0 },
];

const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const toneDb = (value: number) => (clamp(value, 0, 100) - 50) * 0.24;

/** Soft clipping curve; amount 0 remains nearly clean while 1 is strongly saturated. */
export function preampCurve(amount: number, character: number, size = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(size * Float32Array.BYTES_PER_ELEMENT));
  const drive = 0.5 + clamp(amount, 0, 1) * 22;
  const asymmetry = character % 3 === 0 ? 0.08 : character % 3 === 1 ? -0.05 : 0;
  for (let i = 0; i < size; i++) {
    const x = (i * 2) / (size - 1) - 1;
    const shifted = x + asymmetry * Math.max(0, x);
    const soft = ((1 + drive) * shifted) / (1 + drive * Math.abs(shifted));
    curve[i] = clamp(soft - asymmetry * 0.4, -1, 1);
  }
  return curve;
}

function renderStrum(ctx: BaseAudioContext, notes: number[]): AudioBuffer {
  const seconds = 2.4;
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  notes.forEach((midi, index) => {
    pluckString(data, ctx.sampleRate, midiHz(midi), Math.round(index * 0.012 * ctx.sampleRate), 0.2);
  });
  return buffer;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const PARAM_GLIDE_SEC = 0.03;

/** Browser-only guitar phrase through an approximate amp, cabinet and microphone chain. */
export class PreampPreviewEngine {
  private cfg: PreampPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private strums: AudioBuffer[] = [];
  private nodes: {
    master: GainNode;
    input: GainNode;
    shaper: WaveShaperNode;
    compressor: DynamicsCompressorNode;
    ampLowCut: BiquadFilterNode;
    ampHighCut: BiquadFilterNode;
    bass: BiquadFilterNode;
    middle: BiquadFilterNode;
    treble: BiquadFilterNode;
    presence: BiquadFilterNode;
    cabLowCut: BiquadFilterNode;
    cabHighCut: BiquadFilterNode;
    cabBody: BiquadFilterNode;
    micLow: BiquadFilterNode;
    micPresence: BiquadFilterNode;
    micAir: BiquadFilterNode;
  } | null = null;
  private nextStrumTime = 0;
  private chord = 0;
  private lastStrum: GainNode | null = null;

  constructor(cfg: PreampPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: PreampPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.strums.length === 0) this.strums = GUITAR_PROGRESSION.map((notes) => renderStrum(ctx, notes));
    this.buildGraph(ctx);
    this.nextStrumTime = ctx.currentTime + 0.05;
    this.chord = 0;
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
    this.lastStrum = null;
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
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const input = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = "4x";
    const compressor = ctx.createDynamicsCompressor();
    const filter = (type: BiquadFilterType, frequency: number) => {
      const node = ctx.createBiquadFilter();
      node.type = type;
      node.frequency.value = frequency;
      return node;
    };
    const ampLowCut = filter("highpass", 60);
    const ampHighCut = filter("lowpass", 10000);
    const bass = filter("lowshelf", 120);
    const middle = filter("peaking", 750);
    middle.Q.value = 0.8;
    const treble = filter("highshelf", 3200);
    const presence = filter("peaking", 5200);
    presence.Q.value = 0.75;
    const cabLowCut = filter("highpass", 60);
    const cabHighCut = filter("lowpass", 7000);
    const cabBody = filter("peaking", 800);
    cabBody.Q.value = 0.8;
    const micLow = filter("lowshelf", 180);
    const micPresence = filter("peaking", 4000);
    micPresence.Q.value = 1;
    const micAir = filter("highshelf", 7500);

    input
      .connect(shaper)
      .connect(compressor)
      .connect(ampLowCut)
      .connect(ampHighCut)
      .connect(bass)
      .connect(middle)
      .connect(treble)
      .connect(presence)
      .connect(cabLowCut)
      .connect(cabHighCut)
      .connect(cabBody)
      .connect(micLow)
      .connect(micPresence)
      .connect(micAir)
      .connect(master);

    this.nodes = {
      master,
      input,
      shaper,
      compressor,
      ampLowCut,
      ampHighCut,
      bass,
      middle,
      treble,
      presence,
      cabLowCut,
      cabHighCut,
      cabBody,
      micLow,
      micPresence,
      micAir,
    };
    this.applySettings();
  }

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const amp = AMP_VOICES[clamp(Math.round(this.cfg.ampType), 0, AMP_VOICES.length - 1)]!;
    const cab = CABINETS[clamp(Math.round(this.cfg.speakerType), 0, CABINETS.length - 1)]!;
    const mic = MICROPHONES[clamp(Math.round(this.cfg.micType), 0, MICROPHONES.length - 1)]!;
    const gain = clamp(this.cfg.gain, 0, 120) / 120;
    n.input.gain.setTargetAtTime(0.8 + gain * 4.5, t, PARAM_GLIDE_SEC);
    n.shaper.curve = preampCurve(clamp(amp.drive + gain * 0.55, 0, 1), this.cfg.ampType);
    const comp = clamp(this.cfg.tComp, 0, 20) / 20;
    n.compressor.threshold.setTargetAtTime(-4 - comp * 28, t, PARAM_GLIDE_SEC);
    n.compressor.ratio.setTargetAtTime(1.2 + comp * 7, t, PARAM_GLIDE_SEC);
    n.compressor.knee.setTargetAtTime(18 - comp * 12, t, PARAM_GLIDE_SEC);
    n.compressor.attack.setTargetAtTime(0.004 + (1 - comp) * 0.02, t, PARAM_GLIDE_SEC);
    n.compressor.release.setTargetAtTime(0.08 + comp * 0.18, t, PARAM_GLIDE_SEC);
    n.ampLowCut.frequency.setTargetAtTime(amp.lowCut, t, PARAM_GLIDE_SEC);
    n.ampHighCut.frequency.setTargetAtTime(amp.highCut, t, PARAM_GLIDE_SEC);
    n.bass.gain.setTargetAtTime(toneDb(this.cfg.bass) + amp.low, t, PARAM_GLIDE_SEC);
    n.middle.gain.setTargetAtTime(toneDb(this.cfg.middle) + amp.mid, t, PARAM_GLIDE_SEC);
    n.treble.gain.setTargetAtTime(toneDb(this.cfg.treble) + amp.high, t, PARAM_GLIDE_SEC);
    n.presence.gain.setTargetAtTime(toneDb(this.cfg.presence), t, PARAM_GLIDE_SEC);

    const speakerOff = this.cfg.speakerType === 0;
    n.cabLowCut.frequency.setTargetAtTime(speakerOff ? 25 : cab.lowCut, t, PARAM_GLIDE_SEC);
    n.cabHighCut.frequency.setTargetAtTime(speakerOff ? 18000 : cab.highCut, t, PARAM_GLIDE_SEC);
    n.cabBody.frequency.setTargetAtTime(cab.bodyHz, t, PARAM_GLIDE_SEC);
    n.cabBody.gain.setTargetAtTime(speakerOff ? 0 : cab.bodyDb, t, PARAM_GLIDE_SEC);

    const offMic = this.cfg.micDistance === 0;
    const edge = clamp(this.cfg.micPosition, 0, 10) / 10;
    n.micLow.gain.setTargetAtTime(mic.low + (offMic ? 1.5 : 0), t, PARAM_GLIDE_SEC);
    n.micPresence.gain.setTargetAtTime(mic.presence - edge * 4 - (offMic ? 1.5 : 0), t, PARAM_GLIDE_SEC);
    n.micAir.gain.setTargetAtTime(mic.air - edge * 3 - (offMic ? 2 : 0), t, PARAM_GLIDE_SEC);
    const output = clamp(this.cfg.effectLevel, 0, 100) / 100;
    n.master.gain.setTargetAtTime(output * 0.65, t, PARAM_GLIDE_SEC);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const interval = (60 / clamp(this.cfg.bpm, 40, 240)) * 2;
    while (this.nextStrumTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.strum(this.nextStrumTime, this.chord % this.strums.length);
      this.chord++;
      this.nextStrumTime += interval;
    }
  }

  private strum(time: number, chord: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.strums[chord]!;
    const gain = ctx.createGain();
    gain.gain.value = 0.8;
    source.connect(gain).connect(this.nodes!.input);
    this.lastStrum?.gain.setTargetAtTime(0, time, 0.05);
    this.lastStrum = gain;
    source.start(time);
    source.stop(time + source.buffer.duration);
  }
}
