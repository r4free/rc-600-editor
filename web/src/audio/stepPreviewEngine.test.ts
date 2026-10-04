import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { syncRateBeats } from "@rc600/catalog/input-fx";
import {
  StepPreviewEngine,
  filterMakeupGain,
  filterSettings,
  flangerSettings,
  freeRateIndex,
  lfoRateHz,
  phaserSettings,
  ringFrequencyHz,
  type FilterPreview,
  type FlangerPreview,
  type TremoloPreview,
  type PhaserPreview,
  type StepPreviewConfig,
} from "./stepPreview";

class FakeParam {
  value = 0;
  setTargetAtTime(v: number) {
    this.value = v;
    return this;
  }
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

function fakeNode() {
  return {
    type: "",
    buffer: null as unknown,
    curve: null as Float32Array | null,
    loop: false,
    gain: new FakeParam(),
    frequency: new FakeParam(),
    detune: new FakeParam(),
    Q: new FakeParam(),
    pan: new FakeParam(),
    threshold: new FakeParam(),
    knee: new FakeParam(),
    ratio: new FakeParam(),
    attack: new FakeParam(),
    release: new FakeParam(),
    delayTime: new FakeParam(),
    connect<T>(dest: T): T {
      return dest;
    },
    disconnect() {},
    start() {},
    stop() {},
  };
}

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  sampleRate = 8000;
  destination = fakeNode();
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  createBuffer(_ch: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createGain = fakeNode;
  createOscillator = fakeNode;
  createBiquadFilter = fakeNode;
  createStereoPanner = fakeNode;
  createDynamicsCompressor = fakeNode;
  createDelay = fakeNode;
  createBufferSource = fakeNode;
  createWaveShaper = fakeNode;
}

const g = globalThis as unknown as Record<string, unknown>;

beforeEach(() => {
  g.window = { AudioContext: FakeAudioContext, setTimeout: () => 0, setInterval: () => 0 };
});

afterEach(() => {
  delete g.window;
});

const SIXTEENTH = Array.from({ length: 40 }, (_, i) => i).find((i) => syncRateBeats(i) === 0.25)!;

function config(over: Partial<StepPreviewConfig> = {}): StepPreviewConfig {
  return {
    steps: Array.from({ length: 16 }, (_, i) => i * 6),
    activeCount: 16,
    rateIndex: SIXTEENTH,
    bpm: 120,
    target: "volume",
    sound: "tone",
    metronome: false,
    ...over,
  };
}

/** Runs the engine with a fake clock and returns the private internals for inspection. */
function run(cfg: StepPreviewConfig) {
  const engine = new StepPreviewEngine(cfg, () => {});
  const steps: number[] = [];
  const internals = engine as unknown as {
    ctx: FakeAudioContext;
    scheduleStep: (t: number, i: number) => void;
    schedule: () => void;
    phaserNodes: { lfo: ReturnType<typeof fakeNode>; sweep: ReturnType<typeof fakeNode>; stages: ReturnType<typeof fakeNode>[]; dry: ReturnType<typeof fakeNode>; wet: ReturnType<typeof fakeNode> };
    vib: { lfos: ReturnType<typeof fakeNode>[]; mainMod: ReturnType<typeof fakeNode>; colorMod: ReturnType<typeof fakeNode>; dry: ReturnType<typeof fakeNode>; wet: ReturnType<typeof fakeNode> };
    ringNodes: { carrier: ReturnType<typeof fakeNode>; dry: ReturnType<typeof fakeNode>; wet: ReturnType<typeof fakeNode> };
  };
  const original = internals.scheduleStep.bind(engine);
  internals.scheduleStep = (t, i) => {
    steps.push(i);
    original(t, i);
  };
  engine.start();
  const advance = (sec: number) => {
    internals.ctx.currentTime += sec;
    internals.schedule();
  };
  return { engine, internals, steps, advance };
}

const PHASER: PhaserPreview = {
  rateIndex: SIXTEENTH,
  depth: 50,
  resonance: 50,
  manual: 50,
  dryLevel: 100,
  wetLevel: 100,
  stepParam: null,
};

describe("preview engine: Phaser controls", () => {
  it("Depth, Resonance, Manual, Rate and levels reach the audio graph", () => {
    const { engine, internals } = run(config({ sound: "phaser", target: "phaser", phaser: PHASER }));
    const p = () => internals.phaserNodes;
    const before = { sweep: p().sweep.gain.value, q: p().stages[0]!.Q.value, f: p().stages[0]!.frequency.value };
    assert.equal(before.sweep, phaserSettings(50, 50, 50).sweepCents);

    engine.update(config({ sound: "phaser", target: "phaser", phaser: { ...PHASER, depth: 100 } }));
    assert.equal(p().sweep.gain.value, 2400);
    engine.update(config({ sound: "phaser", target: "phaser", phaser: { ...PHASER, resonance: 100 } }));
    assert.equal(p().stages[0]!.Q.value, 8);
    engine.update(config({ sound: "phaser", target: "phaser", phaser: { ...PHASER, manual: 0 } }));
    assert.equal(p().stages[0]!.frequency.value, 150);
    const slowRate = p().lfo.frequency.value;
    engine.update(config({ sound: "phaser", target: "phaser", phaser: { ...PHASER, rateIndex: SIXTEENTH - 2 } }));
    assert.notEqual(p().lfo.frequency.value, slowRate);
    engine.update(config({ sound: "phaser", target: "phaser", phaser: { ...PHASER, dryLevel: 0, wetLevel: 40 } }));
    assert.equal(p().dry.gain.value, 0);
    assert.equal(p().wet.gain.value, 0.4);
    engine.dispose();
  });

  it("with Sequence ON the steps drive the chosen target instead of the knob", () => {
    const steps = Array.from({ length: 16 }, (_, i) => (i % 2 ? 0 : 100));
    const cfg = config({ steps, sound: "phaser", target: "phaser", phaser: { ...PHASER, stepParam: "depth" } });
    const { engine, internals } = run(cfg);
    internals.scheduleStep(0, 1);
    assert.equal(internals.phaserNodes.sweep.gain.value, 0);
    internals.scheduleStep(0, 2);
    assert.equal(internals.phaserNodes.sweep.gain.value, 2400);
    engine.dispose();
  });

  it("each Target routes the steps to its own parameter", () => {
    const steps = Array(16).fill(0);
    const expect: Record<NonNullable<PhaserPreview["stepParam"]>, (n: ReturnType<typeof run>["internals"]["phaserNodes"]) => number> = {
      depth: (n) => n.sweep.gain.value,
      resonance: (n) => n.stages[0]!.Q.value,
      manual: (n) => n.stages[0]!.frequency.value,
      dryLevel: (n) => n.dry.gain.value,
      wetLevel: (n) => n.wet.gain.value,
    };
    for (const param of Object.keys(expect) as (keyof typeof expect)[]) {
      const off = run(config({ steps, sound: "phaser", target: "phaser", phaser: PHASER }));
      const on = run(config({ steps, sound: "phaser", target: "phaser", phaser: { ...PHASER, stepParam: param } }));
      on.internals.scheduleStep(0, 0);
      assert.notEqual(expect[param](on.internals.phaserNodes), expect[param](off.internals.phaserNodes), param);
      off.engine.dispose();
      on.engine.dispose();
    }
  });
});

const FILTER: FilterPreview = {
  kind: "lowpass",
  rateIndex: SIXTEENTH,
  depth: 50,
  resonance: 50,
  cutoff: 50,
  stepRate: 0,
  stepParam: null,
};

describe("preview engine: LPF / BPF / HPF controls", () => {
  type Node = ReturnType<typeof fakeNode>;
  const internalsOf = (r: ReturnType<typeof run>) =>
    r.engine as unknown as { filter: Node; filterNodes: { lfo: Node; sweep: Node } };
  const cfg = (f: Partial<FilterPreview>) => config({ target: "filter", filter: { ...FILTER, ...f } });

  it("Rate, Depth, Resonance, Cutoff and the filter type reach the audio graph", () => {
    const r = run(cfg({}));
    const n = () => internalsOf(r);
    const s = filterSettings(50, 50, 50);
    assert.equal(n().filter.frequency.value, s.cutoffHz);
    assert.equal(n().filter.Q.value, s.q);
    assert.equal(n().filterNodes.sweep.gain.value, s.sweepCents);
    r.engine.update(cfg({ cutoff: 0 }));
    assert.equal(n().filter.frequency.value, 150);
    r.engine.update(cfg({ resonance: 100 }));
    assert.equal(n().filter.Q.value, 14.5);
    r.engine.update(cfg({ depth: 0 }));
    assert.equal(n().filterNodes.sweep.gain.value, 0);
    const before = n().filterNodes.lfo.frequency.value;
    r.engine.update(cfg({ rateIndex: SIXTEENTH - 2 }));
    assert.notEqual(n().filterNodes.lfo.frequency.value, before);
    r.engine.update(cfg({ kind: "highpass" }));
    assert.equal(n().filter.type, "highpass");
    r.engine.dispose();
  });

  it("Step Rate holds the sweep in steps instead of gliding", () => {
    const r = run(cfg({ stepRate: SIXTEENTH + 1 }));
    assert.equal(internalsOf(r).filterNodes.sweep.gain.value, 0);
    r.advance(0.2);
    assert.notEqual(internalsOf(r).filter.detune.value, 0);
    r.engine.update(cfg({ stepRate: 0 }));
    assert.equal(internalsOf(r).filterNodes.sweep.gain.value, filterSettings(50, 50, 50).sweepCents);
    r.engine.dispose();
  });

  it("the steps drive Cutoff or Depth, whichever Target is chosen", () => {
    const steps = Array(16).fill(0);
    const cutoff = run(config({ steps, target: "filter", filter: { ...FILTER, stepParam: "cutoff" } }));
    cutoff.internals.scheduleStep(0, 0);
    assert.equal(internalsOf(cutoff).filter.frequency.value, 150);
    const depth = run(config({ steps, target: "filter", filter: { ...FILTER, stepParam: "depth" } }));
    depth.internals.scheduleStep(0, 0);
    assert.equal(internalsOf(depth).filterNodes.sweep.gain.value, 0);
    assert.equal(internalsOf(depth).filter.frequency.value, filterSettings(50, 50, 50).cutoffHz);
    cutoff.engine.dispose();
    depth.engine.dispose();
  });

  it("BPF makes up the loudness lost when Resonance narrows the band", () => {
    assert.equal(filterMakeupGain("lowpass", 14.5), 1);
    assert.equal(filterMakeupGain("bandpass", 0.5), 1);
    assert.ok(filterMakeupGain("bandpass", 14.5) > filterMakeupGain("bandpass", 4));
    const r = run(cfg({ kind: "bandpass", resonance: 100 }));
    const makeup = (r.engine as unknown as { filterNodes: { makeup: Node } }).filterNodes.makeup;
    assert.equal(makeup.gain.value, filterMakeupGain("bandpass", 14.5));
    r.engine.update(cfg({ kind: "lowpass", resonance: 100 }));
    assert.equal(makeup.gain.value, 1);
    r.engine.dispose();
  });
});

const FLANGER: FlangerPreview = {
  rateIndex: SIXTEENTH,
  depth: 50,
  resonance: 50,
  manual: 50,
  separation: 0,
  dryLevel: 100,
  wetLevel: 100,
  stepParam: null,
};

describe("preview engine: Flanger controls", () => {
  type Nodes = { lfo: Node; sweepL: Node; sweepR: Node; delays: Node[]; feedbacks: Node[]; pans: Node[]; dry: Node; wet: Node };
  type Node = ReturnType<typeof fakeNode>;
  const nodesOf = (r: ReturnType<typeof run>) => (r.engine as unknown as { flangerNodes: Nodes }).flangerNodes;
  const cfg = (flanger: FlangerPreview, over: Partial<StepPreviewConfig> = {}) =>
    config({ sound: "flanger", target: "flanger", flanger, ...over });

  it("Depth, Resonance, Manual, Separation, Rate and levels reach the audio graph", () => {
    const r = run(cfg(FLANGER));
    const n = () => nodesOf(r);
    const base = flangerSettings(50, 50, 50, 0);
    assert.equal(n().delays[0]!.delayTime.value, base.delaySec);
    assert.equal(n().sweepR.gain.value, n().sweepL.gain.value);
    assert.equal(n().pans[1]!.pan.value, 0);

    r.engine.update(cfg({ ...FLANGER, depth: 100 }));
    assert.equal(n().sweepL.gain.value, flangerSettings(50, 100, 50, 0).sweepSec);
    r.engine.update(cfg({ ...FLANGER, resonance: 100 }));
    assert.equal(n().feedbacks[0]!.gain.value, 0.9);
    r.engine.update(cfg({ ...FLANGER, manual: 100 }));
    assert.ok(n().delays[0]!.delayTime.value < base.delaySec);
    r.engine.update(cfg({ ...FLANGER, separation: 100 }));
    assert.equal(n().sweepR.gain.value, -n().sweepL.gain.value);
    assert.equal(n().pans[0]!.pan.value, -1);
    assert.equal(n().pans[1]!.pan.value, 1);
    const hz = n().lfo.frequency.value;
    r.engine.update(cfg({ ...FLANGER, rateIndex: SIXTEENTH - 2 }));
    assert.notEqual(n().lfo.frequency.value, hz);
    r.engine.update(cfg({ ...FLANGER, dryLevel: 30, wetLevel: 0 }));
    assert.equal(n().dry.gain.value, 0.3);
    assert.equal(n().wet.gain.value, 0);
    r.engine.dispose();
  });

  it("each Target routes the steps to its own parameter", () => {
    const steps = Array(16).fill(0);
    const read: Record<NonNullable<FlangerPreview["stepParam"]>, (n: Nodes) => number> = {
      depth: (n) => n.sweepL.gain.value,
      resonance: (n) => n.feedbacks[0]!.gain.value,
      manual: (n) => n.delays[0]!.delayTime.value,
      separation: (n) => n.sweepR.gain.value,
      dryLevel: (n) => n.dry.gain.value,
      wetLevel: (n) => n.wet.gain.value,
    };
    for (const param of Object.keys(read) as (keyof typeof read)[]) {
      const knobs = { ...FLANGER, separation: 50 };
      const off = run(cfg(knobs, { steps }));
      const on = run(cfg({ ...knobs, stepParam: param }, { steps }));
      on.internals.scheduleStep(0, 0);
      assert.notEqual(read[param](nodesOf(on)), read[param](nodesOf(off)), param);
      off.engine.dispose();
      on.engine.dispose();
    }
  });
});

describe("preview engine: Tremolo controls", () => {
  type Node = ReturnType<typeof fakeNode>;
  type Nodes = { lfo: Node; shaper: Node; swing: Node; amp: Node; output: Node };
  const nodesOf = (r: ReturnType<typeof run>) => (r.engine as unknown as { tremNodes: Nodes }).tremNodes;
  const TREMOLO: TremoloPreview = { rateIndex: SIXTEENTH, depth: 50, waveform: 0, level: 50, stepParam: null };
  const cfg = (tremolo: TremoloPreview, over: Partial<StepPreviewConfig> = {}) =>
    config({ sound: "tremolo", target: "tremolo", tremolo, ...over });

  it("Rate, Depth, Waveform and Level reach the audio graph", () => {
    const r = run(cfg(TREMOLO));
    const n = () => nodesOf(r);
    assert.equal(n().swing.gain.value, 0.25);
    assert.equal(n().amp.gain.value, 0.75);
    assert.equal(n().output.gain.value, 1);

    r.engine.update(cfg({ ...TREMOLO, depth: 100 }));
    assert.equal(n().swing.gain.value, 0.5);
    assert.equal(n().amp.gain.value, 0.5);
    const smooth = n().shaper.curve!;
    r.engine.update(cfg({ ...TREMOLO, waveform: 100 }));
    assert.notEqual(n().shaper.curve, smooth);
    assert.ok(n().shaper.curve![600]! > smooth[600]!);
    const hz = n().lfo.frequency.value;
    r.engine.update(cfg({ ...TREMOLO, rateIndex: SIXTEENTH - 2 }));
    assert.notEqual(n().lfo.frequency.value, hz);
    r.engine.update(cfg({ ...TREMOLO, level: 0 }));
    assert.equal(n().output.gain.value, 0);
    r.engine.dispose();
  });

  it("Target Rate and Depth follow the steps", () => {
    const steps = Array.from({ length: 16 }, (_, i) => (i % 2 ? 100 : 0));
    const rate = run(cfg({ ...TREMOLO, stepParam: "rate" }, { steps }));
    rate.internals.scheduleStep(0, 0);
    const slow = nodesOf(rate).lfo.frequency.value;
    rate.internals.scheduleStep(0, 1);
    assert.ok(nodesOf(rate).lfo.frequency.value > slow);
    assert.equal(nodesOf(rate).lfo.frequency.value, lfoRateHz(freeRateIndex(100), 120));

    const depth = run(cfg({ ...TREMOLO, stepParam: "depth" }, { steps }));
    depth.internals.scheduleStep(0, 0);
    assert.equal(nodesOf(depth).swing.gain.value, 0);
    depth.internals.scheduleStep(0, 1);
    assert.equal(nodesOf(depth).swing.gain.value, 0.5);
    rate.engine.dispose();
    depth.engine.dispose();
  });
});

describe("preview engine: Vibrato and Ring Mod controls", () => {
  it("Vibrato Rate, Depth, Color and levels reach the audio graph", () => {
    const vibrato = { rateIndex: SIXTEENTH, depth: 50, color: 0, dryLevel: 0, wetLevel: 100, stepParam: null };
    const { engine, internals } = run(config({ target: "vibrato", vibrato }));
    const v = () => internals.vib;
    const depth = v().mainMod.gain.value;
    engine.update(config({ target: "vibrato", vibrato: { ...vibrato, depth: 100 } }));
    assert.ok(v().mainMod.gain.value > depth);
    assert.equal(v().colorMod.gain.value, 0);
    engine.update(config({ target: "vibrato", vibrato: { ...vibrato, color: 100 } }));
    assert.ok(v().colorMod.gain.value > 0);
    const hz = v().lfos[0]!.frequency.value;
    engine.update(config({ target: "vibrato", vibrato: { ...vibrato, rateIndex: SIXTEENTH - 2 } }));
    assert.notEqual(v().lfos[0]!.frequency.value, hz);
    engine.update(config({ target: "vibrato", vibrato: { ...vibrato, dryLevel: 60 } }));
    assert.equal(v().dry.gain.value, 0.6);
    engine.dispose();
  });

  it("Ring Mod Frequency and Balance reach the audio graph", () => {
    const ring = { frequency: 20, balance: 50, stepFrequency: false };
    const { engine, internals } = run(config({ sound: "ring", target: "ring", ring }));
    assert.equal(internals.ringNodes.carrier.frequency.value, ringFrequencyHz(20));
    engine.update(config({ sound: "ring", target: "ring", ring: { ...ring, frequency: 80 } }));
    assert.equal(internals.ringNodes.carrier.frequency.value, ringFrequencyHz(80));
    engine.update(config({ sound: "ring", target: "ring", ring: { ...ring, balance: 100 } }));
    assert.equal(internals.ringNodes.dry.gain.value, 0);
    engine.dispose();
  });
});

describe("preview engine: Step Sync and Retrigger", () => {
  const sixteenth = 60 / 120 / 4;

  it("Step Sync cues step 1 at every measure; OFF lets the sequence run free", () => {
    const free = run(config({ activeCount: 12 }));
    const synced = run(config({ activeCount: 12, stepSync: true }));
    for (const r of [free, synced]) {
      for (let i = 0; i < 40; i++) r.advance(sixteenth);
    }
    assert.deepEqual(free.steps.slice(12, 20), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(synced.steps.slice(12, 20), [0, 1, 2, 3, 0, 1, 2, 3]);
    free.engine.dispose();
    synced.engine.dispose();
  });

  it("Retrigger ON restarts at step 1 on Play; OFF picks up the free-running position", () => {
    for (const retrigger of [true, false]) {
      const r = run(config({ retrigger }));
      for (let i = 0; i < 4; i++) r.advance(sixteenth);
      r.engine.stop();
      r.internals.ctx.currentTime += sixteenth * 5;
      r.steps.length = 0;
      r.engine.start();
      assert.equal(r.steps[0] === 0, retrigger, `retrigger ${retrigger}: first step ${r.steps[0]}`);
      r.engine.dispose();
    }
  });
});
