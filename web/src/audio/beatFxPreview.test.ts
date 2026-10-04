import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { beatFxCycleState, beatFxPlan, clipGrain, beatLengthBeats, flickRate, renderBeatTrack, SCATTER_PATTERNS } from "./beatFxPreview";

const cfg = (over: Partial<Parameters<typeof beatFxPlan>[0]>) => ({
  effect: "repeat" as const,
  mode: 0,
  lengthBeats: 1,
  flick: 50,
  ...over,
});

describe("beat FX preview helpers", () => {
  it("converts LENGTH / SHIFT labels to beats", () => {
    assert.equal(beatLengthBeats("THRU"), null);
    assert.equal(beatLengthBeats("4MEAS"), 16);
    assert.equal(beatLengthBeats("1MEAS"), 4);
    assert.equal(beatLengthBeats("1/2"), 2);
    assert.equal(beatLengthBeats("1/16"), 0.25);
    assert.ok(Math.abs(beatLengthBeats("1/4T")! - 2 / 3) < 1e-9);
    assert.equal(beatLengthBeats("1/8."), 0.75);
  });

  it("maps FLICK around 50 = normal speed", () => {
    assert.equal(flickRate(50), 1);
    assert.equal(flickRate(0), 0.25);
    assert.equal(flickRate(100), 2);
    assert.ok(flickRate(30) < 1 && flickRate(70) > 1);
  });

  it("plays the track unchanged with THRU", () => {
    const plan = beatFxPlan(cfg({ lengthBeats: null }), 0.5, 8);
    assert.deepEqual(plan, [{ at: 0, offset: 0, dur: 4, reverse: false, span: 4, rate: 1 }]);
  });

  it("repeats one slice forward, in reverse, or alternating", () => {
    const forward = beatFxPlan(cfg({ mode: 0, lengthBeats: 2 }), 0.5, 8);
    assert.equal(forward.length, 4);
    assert.ok(forward.every((g) => g.offset === 0 && !g.reverse && g.dur === 1));
    assert.ok(beatFxPlan(cfg({ mode: 1, lengthBeats: 2 }), 0.5, 8).every((g) => g.reverse));
    const mix = beatFxPlan(cfg({ mode: 2, lengthBeats: 2 }), 0.5, 8);
    assert.deepEqual(mix.map((g) => g.reverse), [false, true, false, true]);
    const long = beatFxPlan(cfg({ lengthBeats: 3 }), 0.5, 8);
    assert.equal(long.at(-1)!.dur, 1);
  });

  it("shifts playback ahead (Future) or behind (Past)", () => {
    assert.equal(beatFxPlan(cfg({ effect: "shift", mode: 0, lengthBeats: 1 }), 0.5, 8)[0]!.offset, 0.5);
    assert.equal(beatFxPlan(cfg({ effect: "shift", mode: 1, lengthBeats: 1 }), 0.5, 8)[0]!.offset, -0.5);
  });

  it("scrubs slices in the order of the pattern", () => {
    for (const [mode, pattern] of SCATTER_PATTERNS.entries()) {
      const plan = beatFxPlan(cfg({ effect: "scatter", mode, lengthBeats: 0.5 }), 0.5, 4);
      assert.equal(plan.length, 8);
      assert.deepEqual(plan.map((g) => g.offset / 0.25), pattern.order);
      assert.deepEqual(
        plan.flatMap((g, i) => (g.reverse ? [i] : [])),
        pattern.reverse,
      );
    }
  });

  it("flicks each beat unless Flick is centered", () => {
    assert.equal(beatFxPlan(cfg({ effect: "flick", flick: 50 }), 0.5, 8).length, 1);
    const slow = beatFxPlan(cfg({ effect: "flick", flick: 20 }), 0.5, 8);
    assert.equal(slow.length, 8);
    assert.ok(slow.every((g) => g.rate < 1));
  });

  it("renders a four-bar track at the tempo", () => {
    const data = renderBeatTrack(8000, 120);
    assert.equal(data.length, 8000 * 8);
    assert.ok(data.some((v) => Math.abs(v) > 0.1));
  });

  it("clips slices to one beat without losing the source position", () => {
    const fwd = { at: 0, offset: 1, dur: 2, reverse: false, span: 2, rate: 1 };
    assert.deepEqual(clipGrain(fwd, 0.5, 1), { ...fwd, at: 0.5, dur: 0.5, offset: 1.5 });
    const rev = { at: 0, offset: 0, dur: 2, reverse: true, span: 2, rate: 1 };
    const part = clipGrain(rev, 0.5, 1)!;
    assert.equal(part.offset + part.span, 1.5);
    assert.equal(part.dur, 0.5);
    assert.equal(clipGrain(fwd, 2, 3), null);
  });

  it("plays the track clean once, then with the effect on its last two bars", () => {
    const states = Array.from({ length: 8 }, (_, bar) => beatFxCycleState(bar));
    assert.deepEqual(states.map((s) => s.fxOn), [false, false, false, false, false, false, true, true]);
    assert.deepEqual(states.map((s) => s.trackBar), [0, 1, 2, 3, 0, 1, 2, 3]);
    assert.equal(beatFxCycleState(8).pass, 1);
    assert.equal(beatFxCycleState(5).pass, 2);
  });
});
