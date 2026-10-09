/** Plays converted parts (looped) or the whole drum track, in the browser or on the RC-600 over MIDI. */
import { drumClass, type PartRole } from "./sectionSuggest";
import { lastBarOnly } from "./rhythmRc0";
import { SMF_PPQ } from "./smfWriter";
import { mapToKit, type PartEvents } from "./exportPack";
import type { DrumScore } from "./scoreDrumEvents";
import { parseSf2, type Sf2Bank, type Sf2Zone } from "./sf2";
import { kitModel, type KitModel, type SynthSound } from "./kitModels";

export type DrumSoundId =
  | "rc-model"
  | "gm-standard"
  | "gm-room"
  | "gm-jazz"
  | "gm-brush"
  | "synth-basic"
  | "synth-electronic"
  | "rc600";

export const DRUM_SOUNDS: readonly { id: DrumSoundId; label: string }[] = [
  { id: "rc-model", label: "RC-600 Kit Preview" },
  { id: "gm-standard", label: "Standard Kit" },
  { id: "gm-room", label: "Room Kit" },
  { id: "gm-jazz", label: "Jazz Kit" },
  { id: "gm-brush", label: "Brush Kit" },
  { id: "synth-basic", label: "Basic Synth" },
  { id: "synth-electronic", label: "Electronic Synth" },
  { id: "rc600", label: "RC-600 Kit (MIDI)" },
];

const GM_PROGRAM: Partial<Record<DrumSoundId, number>> = {
  "gm-standard": 0,
  "gm-room": 8,
  "gm-jazz": 32,
  "gm-brush": 40,
};

const SOUNDFONT_URL = "/soundfont/sonivox.sf2";
const LOOKAHEAD_MS = 120;
const TICK_MS = 25;
const MIDI_GATE_MS = 90;
/** Drum notes have no real note-off; looped samples release after this. */
const DRUM_GATE_S = 0.3;

/** Plays one hit at audio time `at` into `dest`. */
export type AudioVoice = (note: number, velocity: number, at: number, dest: AudioNode) => void;

let sharedCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let bankPromise: Promise<Sf2Bank> | null = null;
const sampleCache = new Map<string, AudioBuffer>();

function audio(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

function envelope(ctx: AudioContext, dest: AudioNode, at: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  g.connect(dest);
  return g;
}

function noiseHit(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  peak: number,
  decay: number,
  freq: number,
  type: BiquadFilterType = "highpass",
): void {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  src.connect(filter).connect(envelope(ctx, dest, at, peak, decay));
  src.start(at);
  src.stop(at + decay + 0.05);
}

function toneHit(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  peak: number,
  decay: number,
  from: number,
  to: number,
  type: OscillatorType = "sine",
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + decay);
  osc.connect(envelope(ctx, dest, at, peak, decay));
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

function basicSynth(ctx: AudioContext): AudioVoice {
  return (note, velocity, at, dest) => {
    const v = (velocity / 127) * 0.6;
    switch (drumClass(note)) {
      case "kick":
        toneHit(ctx, dest, at, v * 1.4, 0.3, 150, 45);
        break;
      case "snare":
        noiseHit(ctx, dest, at, v, 0.16, 1500);
        toneHit(ctx, dest, at, v * 0.6, 0.1, 220, 160, "triangle");
        break;
      case "hat":
        noiseHit(ctx, dest, at, v * 0.5, note === 46 ? 0.3 : 0.05, 7000);
        break;
      case "tom":
        toneHit(ctx, dest, at, v, 0.3, 80 + (note - 41) * 14, 60 + (note - 41) * 10);
        break;
      case "cymbal":
        noiseHit(ctx, dest, at, v * 0.45, note === 51 || note === 59 ? 0.5 : 1.1, 5000);
        break;
      default:
        toneHit(ctx, dest, at, v * 0.6, 0.08, 400 + (note % 12) * 60, 300 + (note % 12) * 50, "square");
    }
  };
}

/** Drum-machine flavour: long 808 kick, clap-like snare, tight metallic hats. */
function electronicSynth(ctx: AudioContext): AudioVoice {
  return (note, velocity, at, dest) => {
    const v = (velocity / 127) * 0.6;
    switch (drumClass(note)) {
      case "kick":
        toneHit(ctx, dest, at, v * 1.6, 0.7, 120, 38);
        break;
      case "snare":
        for (const offset of [0, 0.011, 0.023]) noiseHit(ctx, dest, at + offset, v * 0.8, 0.12, 1200, "bandpass");
        noiseHit(ctx, dest, at + 0.03, v * 0.6, 0.22, 1000, "bandpass");
        break;
      case "hat":
        noiseHit(ctx, dest, at, v * 0.45, note === 46 ? 0.35 : 0.035, 9000);
        toneHit(ctx, dest, at, v * 0.08, note === 46 ? 0.3 : 0.03, 6200, 6000, "square");
        break;
      case "tom":
        toneHit(ctx, dest, at, v * 1.1, 0.45, 110 + (note - 41) * 18, 70 + (note - 41) * 12);
        break;
      case "cymbal":
        noiseHit(ctx, dest, at, v * 0.4, note === 51 || note === 59 ? 0.6 : 1.4, 6500);
        toneHit(ctx, dest, at, v * 0.05, 0.8, 5400, 5200, "square");
        break;
      default:
        toneHit(ctx, dest, at, v * 0.5, 0.06, 800 + (note % 12) * 80, 700 + (note % 12) * 70, "square");
    }
  };
}

function loadBank(): Promise<Sf2Bank> {
  bankPromise ??= fetch(SOUNDFONT_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`Could not load the drum sounds (${r.status}).`);
      return r.arrayBuffer();
    })
    .then((b) => parseSf2(new Uint8Array(b)))
    .catch((err) => {
      bankPromise = null;
      throw err;
    });
  return bankPromise;
}

function zoneBuffer(ctx: AudioContext, bank: Sf2Bank, z: Sf2Zone): AudioBuffer {
  const key = `${z.start}:${z.end}:${z.sampleRate}`;
  let buf = sampleCache.get(key);
  if (!buf) {
    const len = Math.max(1, z.end - z.start);
    buf = ctx.createBuffer(1, len, z.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (bank.pcm[z.start + i] ?? 0) / 32768;
    sampleCache.set(key, buf);
  }
  return buf;
}

function soundfontKit(ctx: AudioContext, bank: Sf2Bank, program: number, tune?: (note: number) => number): AudioVoice {
  const choke = new Map<number, { src: AudioBufferSourceNode; gain: GainNode }[]>();
  return (note, velocity, at, dest) => {
    const rate = tune?.(note) ?? 1;
    let zones = bank.zones(128, program, note, velocity);
    if (!zones.length && program !== 0) zones = bank.zones(128, 0, note, velocity);
    for (const z of zones) {
      if (z.exclusiveClass) {
        for (const prev of choke.get(z.exclusiveClass) ?? []) {
          prev.gain.gain.cancelScheduledValues(at);
          prev.gain.gain.setTargetAtTime(0, at, 0.008);
          try {
            prev.src.stop(at + 0.05);
          } catch {
            /* already stopped */
          }
        }
        choke.set(z.exclusiveClass, []);
      }
      const src = ctx.createBufferSource();
      src.buffer = zoneBuffer(ctx, bank, z);
      src.playbackRate.value = z.playbackRate * rate;
      if (z.loop) {
        src.loop = true;
        src.loopStart = (z.loopStart - z.start) / z.sampleRate;
        src.loopEnd = (z.loopEnd - z.start) / z.sampleRate;
      }
      const level = z.gain * (velocity / 127) ** 2 * 0.9;
      const gain = ctx.createGain();
      const peakAt = at + z.attack;
      const decayAt = peakAt + z.hold;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, peakAt);
      gain.gain.setValueAtTime(level, decayAt);
      gain.gain.setTargetAtTime(level * z.sustain, decayAt, Math.max(0.001, z.decay / 4));
      const offAt = Math.max(decayAt, at + DRUM_GATE_S);
      gain.gain.setTargetAtTime(0, offAt, Math.max(0.005, z.release / 4));
      let stopAt = offAt + z.release + 0.05;
      if (!z.loop) stopAt = Math.min(stopAt, at + (z.end - z.start) / z.sampleRate / (z.playbackRate * rate) + 0.02);
      const panner = ctx.createStereoPanner();
      panner.pan.value = z.pan;
      src.connect(gain).connect(panner).connect(dest);
      src.start(at);
      src.stop(Math.max(at + 0.01, stopAt));
      if (z.exclusiveClass) choke.get(z.exclusiveClass)!.push({ src, gain });
    }
  };
}

type SynthHit = (ctx: AudioContext, note: number, v: number, at: number, dest: AudioNode) => void;

/** Synth voices used by the RC-600 kit models; `v` is the peak level (0–0.6). */
const SYNTH_SOUNDS: Record<SynthSound, SynthHit> = {
  "808-kick": (ctx, _n, v, at, dest) => {
    toneHit(ctx, dest, at, v * 1.7, 0.8, 110, 40);
    toneHit(ctx, dest, at, v * 0.25, 0.012, 1200, 200, "triangle");
  },
  "909-kick": (ctx, _n, v, at, dest) => {
    toneHit(ctx, dest, at, v * 1.6, 0.35, 170, 48);
    noiseHit(ctx, dest, at, v * 0.2, 0.012, 3000);
  },
  "techno-kick": (ctx, _n, v, at, dest) => {
    toneHit(ctx, dest, at, v * 1.8, 0.28, 200, 45);
    toneHit(ctx, dest, at, v * 0.3, 0.03, 900, 120, "triangle");
  },
  clap: (ctx, _n, v, at, dest) => {
    for (const offset of [0, 0.011, 0.023]) noiseHit(ctx, dest, at + offset, v * 0.8, 0.12, 1200, "bandpass");
    noiseHit(ctx, dest, at + 0.03, v * 0.6, 0.22, 1000, "bandpass");
  },
  "909-snare": (ctx, _n, v, at, dest) => {
    toneHit(ctx, dest, at, v * 0.7, 0.12, 240, 180, "triangle");
    noiseHit(ctx, dest, at, v * 0.8, 0.18, 1800);
  },
  "machine-hat": (ctx, note, v, at, dest) => {
    noiseHit(ctx, dest, at, v * 0.45, note === 46 ? 0.35 : 0.035, 9000);
    toneHit(ctx, dest, at, v * 0.08, note === 46 ? 0.3 : 0.03, 6200, 6000, "square");
  },
  "machine-cymbal": (ctx, note, v, at, dest) => {
    noiseHit(ctx, dest, at, v * 0.4, note === 51 || note === 59 ? 0.6 : 1.4, 6500);
    toneHit(ctx, dest, at, v * 0.05, 0.8, 5400, 5200, "square");
  },
  "machine-tom": (ctx, note, v, at, dest) => {
    toneHit(ctx, dest, at, v * 1.1, 0.45, 110 + (note - 41) * 18, 70 + (note - 41) * 12);
  },
  "cajon-bass": (ctx, _n, v, at, dest) => {
    toneHit(ctx, dest, at, v * 1.3, 0.22, 110, 60);
    noiseHit(ctx, dest, at, v * 0.3, 0.05, 400, "lowpass");
  },
  "cajon-slap": (ctx, _n, v, at, dest) => {
    noiseHit(ctx, dest, at, v * 0.9, 0.09, 2500, "bandpass");
    toneHit(ctx, dest, at, v * 0.5, 0.06, 380, 300, "triangle");
  },
  "cajon-tone": (ctx, note, v, at, dest) => {
    toneHit(ctx, dest, at, v * 0.9, 0.15, 180 + (note - 41) * 15, 140 + (note - 41) * 12);
    noiseHit(ctx, dest, at, v * 0.3, 0.04, 1500, "bandpass");
  },
  shaker: (ctx, note, v, at, dest) => {
    noiseHit(ctx, dest, at, v * 0.35, note === 46 ? 0.12 : 0.05, 6000);
  },
  tambourine: (ctx, _n, v, at, dest) => {
    noiseHit(ctx, dest, at, v * 0.4, 0.25, 7000);
    toneHit(ctx, dest, at, v * 0.06, 0.2, 5000, 4900, "square");
  },
};

function roomImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.round(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return buf;
}

/** Tone, compression and room shared by every hit of a kit model, built once per output. */
function modelBus(ctx: AudioContext, model: KitModel, dest: AudioNode): AudioNode {
  const input = ctx.createGain();
  let tail: AudioNode = input;
  const chain = (node: AudioNode) => {
    tail.connect(node);
    tail = node;
  };
  if (model.highpass) {
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = model.highpass;
    chain(f);
  }
  if (model.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = model.lowpass;
    chain(f);
  }
  if (model.compress) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = -6 - model.compress * 24;
    c.ratio.value = 2 + model.compress * 6;
    c.attack.value = 0.005;
    c.release.value = 0.12;
    chain(c);
    const makeup = ctx.createGain();
    makeup.gain.value = 1 + model.compress * 0.8;
    chain(makeup);
  }
  tail.connect(dest);
  if (model.room) {
    const conv = ctx.createConvolver();
    conv.buffer = roomImpulse(ctx, model.roomSeconds ?? 1);
    const wet = ctx.createGain();
    wet.gain.value = model.room;
    tail.connect(conv).connect(wet).connect(dest);
  }
  return input;
}

function kitModelVoice(ctx: AudioContext, bank: Sf2Bank, model: KitModel): AudioVoice {
  const sample = soundfontKit(ctx, bank, model.program, (note) => 2 ** ((model.pitch?.[drumClass(note)] ?? 0) / 12));
  const buses = new WeakMap<AudioNode, AudioNode>();
  return (note, velocity, at, dest) => {
    let bus = buses.get(dest);
    if (!bus) {
      bus = modelBus(ctx, model, dest);
      buses.set(dest, bus);
    }
    const cls = drumClass(note);
    const vel = Math.max(1, Math.min(127, Math.round(velocity * (model.dynamics ?? 1))));
    const level = model.level?.[cls] ?? 1;
    let out: AudioNode = bus;
    if (level !== 1) {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(bus);
      out = g;
    }
    const synth = model.synth?.[cls];
    if (synth) SYNTH_SOUNDS[synth](ctx, note, (vel / 127) * 0.6, at, out);
    else sample(note, vel, at, out);
  };
}

/** Browser voice for `sound` (the RC-600 MIDI option has no browser voice). `kit` picks the RC-600 kit model. */
export async function loadDrumVoice(sound: DrumSoundId, kit = 0): Promise<AudioVoice | null> {
  const ctx = audio();
  if (sound === "rc600") return null;
  if (sound === "rc-model") return kitModelVoice(ctx, await loadBank(), kitModel(kit));
  if (sound === "synth-basic") return basicSynth(ctx);
  if (sound === "synth-electronic") return electronicSynth(ctx);
  const program = GM_PROGRAM[sound] ?? 0;
  return soundfontKit(ctx, await loadBank(), program);
}

export interface PlaybackHit {
  ms: number;
  note: number;
  velocity: number;
}

export interface Playback {
  hits: PlaybackHit[];
  lengthMs: number;
  loop: boolean;
  /** Start time of each bar, relative to playback start (song playback). */
  barStartsMs?: number[];
  firstBar?: number;
  /** Parts in play order (rhythm playback). */
  segments?: PlaybackSegment[];
}

export interface PlaybackSegment {
  role: PartRole;
  startMs: number;
  lengthMs: number;
  /** 1-based pass of this part when it repeats. */
  pass: number;
  passes: number;
}

export interface SequenceStep {
  role: PartRole;
  times: number;
}

/**
 * Pedal order for the picked parts: Intro, then each variation followed by its fill, then Ending.
 * Variations play `variationRepeats` times; intro, fills and ending once.
 */
export function rhythmSequence(picked: readonly PartRole[], variationRepeats: number): SequenceStep[] {
  const on = new Set(picked);
  const order: PartRole[] = ["intro", "varA", "fillA", "varB", "fillB", "varC", "fillC", "varD", "fillD", "ending"];
  const times = Math.max(1, Math.round(variationRepeats));
  return order.filter((r) => on.has(r)).map((role) => ({ role, times: role.startsWith("var") ? times : 1 }));
}

/** Plays `steps` back to back at one tempo, as the pedal would (fills keep their last bar). */
export function rhythmPlayback(
  parts: readonly PartEvents[],
  steps: readonly SequenceStep[],
  opts: { tempoBpm: number; loop: boolean },
): Playback | null {
  const byRole = new Map(parts.map((p) => [p.role, p.role.startsWith("fill") ? lastBarOnly(p) : p] as const));
  const ticksPerMinute = Math.max(20, opts.tempoBpm) * SMF_PPQ;
  const toMs = (tick: number) => (tick * 60_000) / ticksPerMinute;
  const hits: PlaybackHit[] = [];
  const segments: PlaybackSegment[] = [];
  let at = 0;
  for (const step of steps) {
    const part = byRole.get(step.role);
    if (!part || part.lengthTicks <= 0) continue;
    for (let pass = 1; pass <= step.times; pass++) {
      segments.push({ role: step.role, startMs: toMs(at), lengthMs: toMs(part.lengthTicks), pass, passes: step.times });
      for (const n of part.notes) hits.push({ ms: toMs(at + n.tick), note: n.note, velocity: n.velocity });
      at += part.lengthTicks;
    }
  }
  if (!segments.length) return null;
  hits.sort((a, b) => a.ms - b.ms);
  return { hits, lengthMs: toMs(at), loop: opts.loop, segments };
}

/** Segment playing at `ms`, with the position inside it (0–1). */
export function segmentAt(pb: Playback, ms: number): { segment: PlaybackSegment; within: number } | null {
  const segs = pb.segments ?? [];
  const segment = segs.find((s) => ms >= s.startMs && ms < s.startMs + s.lengthMs) ?? segs[segs.length - 1];
  if (!segment) return null;
  return { segment, within: Math.min(1, Math.max(0, (ms - segment.startMs) / segment.lengthMs)) };
}

export function partPlayback(part: PartEvents): Playback {
  const msPerTick = 60_000 / (Math.max(20, part.tempoBpm) * SMF_PPQ);
  return {
    hits: part.notes.map((n) => ({ ms: n.tick * msPerTick, note: n.note, velocity: n.velocity })),
    lengthMs: part.lengthTicks * msPerTick,
    loop: true,
  };
}

/** The selected drum track from `fromBar` to the end, with each bar's own tempo. */
export function songPlayback(score: DrumScore, fromBar = 0): Playback {
  const hits: PlaybackHit[] = [];
  const barStartsMs: number[] = [];
  let ms = 0;
  for (const bar of score.bars.slice(Math.max(0, fromBar))) {
    const msPerTick = 60_000 / (Math.max(20, bar.tempo || 120) * score.ppq);
    barStartsMs.push(ms);
    for (const h of bar.hits) {
      const note = mapToKit(h.note, false);
      if (note != null) hits.push({ ms: ms + h.tick * msPerTick, note, velocity: h.velocity });
    }
    ms += bar.lengthTicks * msPerTick;
  }
  hits.sort((a, b) => a.ms - b.ms);
  return { hits, lengthMs: ms, loop: false, barStartsMs, firstBar: Math.max(0, fromBar) };
}

export interface PlaybackTarget {
  /** Browser voice; ignored when `midi` is set. */
  voice?: AudioVoice | null;
  /** Sends notes to the RC-600 rhythm channel instead of browser audio. */
  midi?: (note: number, velocity: number, down: boolean) => void;
  /** Elapsed milliseconds inside the current loop/song. */
  onPosition?: (ms: number) => void;
  onEnd?: () => void;
}

/**
 * Starts `source`; returns a stop function. Pass a getter to follow edits while a loop plays:
 * the next scheduled window reads the latest hits and length.
 */
export function startPlayback(source: Playback | (() => Playback), target: PlaybackTarget): () => void {
  const current = typeof source === "function" ? source : () => source;
  const useMidi = Boolean(target.midi);
  const ctx = useMidi || !target.voice ? null : audio();
  const master = ctx ? ctx.createGain() : null;
  if (ctx && master) master.connect(ctx.destination);
  const timers = new Set<number>();
  const startPerf = performance.now() + 60;
  const startAudio = ctx ? ctx.currentTime + 0.06 : 0;
  let scheduledUntil = 0;
  let loopStart = 0;
  let stopped = false;
  let ended = false;

  function schedule() {
    const pb = current();
    const loopMs = Math.max(1, pb.lengthMs);
    const now = performance.now() - startPerf;
    if (!pb.loop && now >= pb.lengthMs) {
      if (!ended) {
        ended = true;
        target.onPosition?.(pb.lengthMs);
        target.onEnd?.();
      }
      return;
    }
    const horizon = now + LOOKAHEAD_MS;
    while (scheduledUntil < horizon) {
      if (pb.loop && scheduledUntil >= loopStart + loopMs) {
        loopStart += loopMs;
        continue;
      }
      const base = pb.loop ? loopStart : 0;
      const windowEnd = pb.loop ? Math.min(horizon, loopStart + loopMs) : horizon;
      for (const n of pb.hits) {
        const t = base + n.ms;
        if (t < scheduledUntil || t >= windowEnd) continue;
        if (ctx && master && target.voice) {
          target.voice(n.note, n.velocity, startAudio + t / 1000, master);
        } else if (target.midi) {
          const send = target.midi;
          const on = window.setTimeout(() => {
            timers.delete(on);
            send(n.note, n.velocity, true);
            const off = window.setTimeout(() => {
              timers.delete(off);
              send(n.note, 0, false);
            }, MIDI_GATE_MS);
            timers.add(off);
          }, Math.max(0, t - now));
          timers.add(on);
        }
      }
      scheduledUntil = windowEnd;
    }
    target.onPosition?.(pb.loop ? (((now - loopStart) % loopMs) + loopMs) % loopMs : Math.max(0, now));
  }

  schedule();
  const interval = window.setInterval(() => {
    if (!stopped) schedule();
  }, TICK_MS);

  return () => {
    stopped = true;
    window.clearInterval(interval);
    for (const t of timers) window.clearTimeout(t);
    timers.clear();
    if (ctx && master) {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      window.setTimeout(() => master.disconnect(), 200);
    }
  };
}
