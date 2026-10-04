export interface VocoderPreviewConfig {
  bpm: number;
  /** CARRIER 0–11: MIC1 … INST2-R (0–5), TRACK1–6 (6–11). */
  carrier: number;
  /** Raw TONE 0–100 (−50…+50): darker ↔ brighter vocoder part. */
  tone: number;
  /** ATTACK 0–100. */
  attack: number;
  /** Raw MOD SENS 0–100 (−50…+50). */
  modSens: number;
  /** 0 = direct only, 100 = vocoder only. */
  balance: number;
  /** CARRIER THRU: the carrier is heard on its own too (inputs only). */
  carrierThru: boolean;
  /** OSC VOC: an internal oscillator plays the MIDI notes instead of a track or input. */
  osc?: OscCarrier;
}

export interface OscCarrier {
  /** CARRIER 0–4: SAW, VINTAGE SAW, DETUNE SAW, SQUARE, RECT. */
  wave: number;
  /** OCTAVE 0–3: −2OCT, −1OCT, 0, +1OCT. */
  octave: number;
  /** RELEASE 0–100. */
  release: number;
}

/** OCTAVE index → semitones (−24, −12, 0, +12). */
export const oscOctaveSemis = (octave: number) => (Math.max(0, Math.min(3, octave)) - 2) * 12;

/** RELEASE 0–100 → note decay after note-off (s), 20 ms to 2 s. */
export function oscReleaseSec(release: number): number {
  return 0.02 * 100 ** (Math.max(0, Math.min(100, release)) / 100);
}

/** Fourier sine/cosine terms for the OSC waves that the built-in oscillator types lack. */
export function oscWaveTerms(wave: number, harmonics = 48): { real: Float32Array<ArrayBuffer>; imag: Float32Array<ArrayBuffer> } {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    if (wave === 4) {
      const duty = 0.2;
      real[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * duty);
      imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * duty));
    } else {
      const saw = ((n % 2 ? 1 : -1) * 2) / (n * Math.PI);
      imag[n] = wave === 1 ? saw / (1 + (n / 8) ** 2) : saw;
    }
  }
  return { real, imag };
}

export const VOCODER_BANDS = 14;
const LOW_HZ = 150;
const HIGH_HZ = 6000;

/** Center frequency of vocoder band `i`, log-spaced 150 Hz – 6 kHz. */
export function vocoderBandHz(i: number, count = VOCODER_BANDS): number {
  return LOW_HZ * (HIGH_HZ / LOW_HZ) ** (i / (count - 1));
}

/** Tracks are always heard as loops; an input carrier is heard only with CARRIER THRU on. */
export function carrierAudible(carrier: number, thru: boolean): boolean {
  return carrier >= 6 || thru;
}

/** ATTACK 0–100 → envelope smoothing cutoff (Hz): low = fast and choppy, high = slow and smooth. */
export function vocoderSmoothingHz(attack: number): number {
  const a = Math.max(0, Math.min(100, attack)) / 100;
  return 60 * 2 ** (-a * 3.5);
}

/** MOD SENS −50…+50 → envelope gain (1 at 0, 4× at +50, ¼ at −50). */
export function vocoderSensGain(raw: number): number {
  return 2 ** ((Math.max(0, Math.min(100, raw)) - 50) / 25);
}

/** TONE −50…+50 → treble/bass tilt in dB (±12). */
export const vocoderTiltDb = (raw: number) => ((Math.max(0, Math.min(100, raw)) - 50) / 50) * 12;

/** Spoken syllables: formants (Hz), length in eighths, voiced or noisy ("s", "t"). */
const SYLLABLES: { f: [number, number, number]; eighths: number; noise?: boolean }[] = [
  { f: [730, 1090, 2440], eighths: 1 },
  { f: [270, 2290, 3010], eighths: 1 },
  { f: [3000, 5000, 7000], eighths: 1, noise: true },
  { f: [570, 840, 2410], eighths: 2 },
  { f: [530, 1840, 2480], eighths: 1 },
  { f: [300, 870, 2240], eighths: 1 },
  { f: [730, 1090, 2440], eighths: 2 },
  { f: [3000, 5000, 7000], eighths: 1, noise: true },
  { f: [270, 2290, 3010], eighths: 1 },
  { f: [570, 840, 2410], eighths: 1 },
  { f: [530, 1840, 2480], eighths: 1 },
  { f: [730, 1090, 2440], eighths: 3 },
];
/** Carrier chords (MIDI): Am – F – C – G, one per bar. */
const CHORDS = [
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [48, 55, 60, 64],
  [55, 59, 62, 67],
];

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const GLIDE = 0.03;

/** Browser-only vocoder: a spoken rhythm shapes a chord pad (the carrier) band by band. */
export class VocoderPreviewEngine {
  private cfg: VocoderPreviewConfig;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer | null = null;
  private nodes: {
    master: GainNode;
    voice: GainNode;
    carrier: GainNode;
    dry: GainNode;
    wet: GainNode;
    thru: GainNode;
    sens: GainNode;
    smooth: BiquadFilterNode[];
    lowShelf: BiquadFilterNode;
    highShelf: BiquadFilterNode;
  } | null = null;
  private nextEighth = 0;
  private eighth = 0;
  private syllable = 0;
  private left = 0;

  constructor(cfg: VocoderPreviewConfig) {
    this.cfg = cfg;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  update(cfg: VocoderPreviewConfig): void {
    this.cfg = cfg;
    this.applySettings();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (!this.noise) {
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    const voice = ctx.createGain();
    const carrier = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const thru = ctx.createGain();
    voice.connect(dry).connect(master);
    carrier.connect(thru).connect(master);
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 300;
    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 2000;
    const makeup = ctx.createGain();
    makeup.gain.value = 9;
    makeup.connect(lowShelf).connect(highShelf).connect(wet).connect(master);

    const sens = ctx.createGain();
    voice.connect(sens);
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.abs((i / (curve.length - 1)) * 2 - 1);
    const smooth: BiquadFilterNode[] = [];
    for (let i = 0; i < VOCODER_BANDS; i++) {
      const hz = vocoderBandHz(i);
      const modBand = ctx.createBiquadFilter();
      modBand.type = "bandpass";
      modBand.frequency.value = hz;
      modBand.Q.value = 5;
      const rect = ctx.createWaveShaper();
      rect.curve = curve;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.5;
      smooth.push(lp);
      sens.connect(modBand).connect(rect).connect(lp);

      const carBand = ctx.createBiquadFilter();
      carBand.type = "bandpass";
      carBand.frequency.value = hz;
      carBand.Q.value = 5;
      const vca = ctx.createGain();
      vca.gain.value = 0;
      lp.connect(vca.gain);
      carrier.connect(carBand).connect(vca).connect(makeup);
    }
    this.nodes = { master, voice, carrier, dry, wet, thru, sens, smooth, lowShelf, highShelf };
    this.applySettings();
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

  private applySettings(): void {
    const ctx = this.ctx;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const b = Math.max(0, Math.min(100, this.cfg.balance)) / 100;
    n.dry.gain.setTargetAtTime(1 - b, t, GLIDE);
    n.wet.gain.setTargetAtTime(b, t, GLIDE);
    n.thru.gain.setTargetAtTime(carrierAudible(this.cfg.carrier, this.cfg.carrierThru) ? 0.35 : 0, t, GLIDE);
    n.sens.gain.setTargetAtTime(vocoderSensGain(this.cfg.modSens), t, GLIDE);
    const hz = vocoderSmoothingHz(this.cfg.attack);
    for (const lp of n.smooth) lp.frequency.setTargetAtTime(hz, t, GLIDE);
    const tilt = vocoderTiltDb(this.cfg.tone);
    n.lowShelf.gain.setTargetAtTime(-tilt, t, GLIDE);
    n.highShelf.gain.setTargetAtTime(tilt, t, GLIDE);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nodes) return;
    const eighthSec = 30 / Math.max(20, this.cfg.bpm);
    while (this.nextEighth < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const t = this.nextEighth;
      if (this.eighth % 8 === 0) {
        this.chord(t, CHORDS[Math.floor(this.eighth / 8) % CHORDS.length]!, eighthSec * 8);
      }
      if (this.left <= 0) {
        const s = SYLLABLES[this.syllable % SYLLABLES.length]!;
        this.speak(t, s.eighths * eighthSec, s.f, Boolean(s.noise));
        this.left = s.eighths;
        this.syllable++;
      }
      this.left--;
      this.eighth++;
      this.nextEighth += eighthSec;
    }
  }

  private speak(t: number, dur: number, formants: [number, number, number], noisy: boolean): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    const len = noisy ? Math.min(dur, 0.12) : dur * 0.85;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.6, t + 0.02);
    env.gain.setValueAtTime(0.6, t + len * 0.8);
    env.gain.linearRampToValueAtTime(0, t + len);
    env.connect(this.nodes!.voice);
    let src: AudioScheduledSourceNode;
    if (noisy) {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      src = n;
    } else {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.linearRampToValueAtTime(115, t + len);
      src = osc;
    }
    formants.forEach((hz, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz;
      bp.Q.value = noisy ? 1.5 : 7;
      const g = ctx.createGain();
      g.gain.value = [2.6, 1.6, 0.8][i]!;
      src.connect(bp).connect(g).connect(env);
    });
    src.start(t);
    src.stop(t + len + 0.05);
  }

  private chord(t: number, notes: number[], dur: number): void {
    if (this.cfg.osc) {
      this.oscChord(t, notes, dur, this.cfg.osc);
      return;
    }
    const ctx = this.ctx!;
    for (const m of notes) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midiHz(m);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.03);
        g.gain.setValueAtTime(0.06, t + dur - 0.05);
        g.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(g).connect(this.nodes!.carrier);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }
  }

  /** MIDI notes held for all but the last eighth of the bar, so Release is heard before the next chord. */
  private oscChord(t: number, notes: number[], dur: number, osc: OscCarrier): void {
    const ctx = this.ctx!;
    const hold = dur * (7 / 8);
    const release = oscReleaseSec(osc.release);
    const shift = oscOctaveSemis(osc.octave);
    const custom = osc.wave === 1 || osc.wave === 4 ? oscWaveTerms(osc.wave) : null;
    const wave = custom ? ctx.createPeriodicWave(custom.real, custom.imag) : null;
    for (const m of notes) {
      for (const detune of osc.wave === 2 ? [-12, 12] : [0]) {
        const o = ctx.createOscillator();
        if (wave) o.setPeriodicWave(wave);
        else o.type = osc.wave === 3 ? "square" : "sawtooth";
        o.frequency.value = midiHz(m + shift);
        o.detune.value = detune;
        const g = ctx.createGain();
        const level = osc.wave === 2 ? 0.06 : 0.09;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + 0.01);
        g.gain.setValueAtTime(level, t + hold);
        g.gain.setTargetAtTime(0, t + hold, release / 4);
        o.connect(g).connect(this.nodes!.carrier);
        o.start(t);
        o.stop(t + hold + release + 0.1);
      }
    }
  }
}
