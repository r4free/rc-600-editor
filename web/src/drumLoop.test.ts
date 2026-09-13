import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  barDurationSec,
  beatIntervalSec,
  clampBpm,
  clampVelocity,
  evenDistributeHits,
  mixPadVelocity,
  parseOptionalBpm,
  parseOptionalPadVelocity,
  resolvePadTiming,
  resolvePadVelocity,
  stepIntervalSec,
} from "./drumLoop.js";

describe("drumLoop", () => {
  it("falls back to global when pad overrides are blank", () => {
    assert.deepEqual(resolvePadTiming({ bpm: 100, meter: "3/4" }, undefined), {
      bpm: 100,
      meter: "3/4",
    });
    assert.deepEqual(resolvePadTiming({ bpm: 100, meter: "3/4" }, { bpm: null, meter: null }), {
      bpm: 100,
      meter: "3/4",
    });
  });

  it("prefers pad BPM and meter when set", () => {
    assert.deepEqual(resolvePadTiming({ bpm: 120, meter: "4/4" }, { bpm: 90, meter: "6/8" }), {
      bpm: 90,
      meter: "6/8",
    });
    assert.deepEqual(resolvePadTiming({ bpm: 120, meter: "4/4" }, { bpm: 140 }), {
      bpm: 140,
      meter: "4/4",
    });
    assert.deepEqual(resolvePadTiming({ bpm: 120, meter: "4/4" }, { meter: "3/4" }), {
      bpm: 120,
      meter: "3/4",
    });
  });

  it("computes quarter-note beat interval from BPM", () => {
    assert.equal(beatIntervalSec(120), 0.5);
    assert.equal(beatIntervalSec(60), 1);
  });

  it("clamps BPM and parses optional inputs", () => {
    assert.equal(clampBpm(10), 20);
    assert.equal(clampBpm(400), 300);
    assert.equal(parseOptionalBpm(""), null);
    assert.equal(parseOptionalBpm("  "), null);
    assert.equal(parseOptionalBpm("128"), 128);
  });

  it("evenly distributes hits across 16 steps", () => {
    assert.deepEqual(evenDistributeHits(0), []);
    assert.deepEqual(evenDistributeHits(1), [0]);
    assert.deepEqual(evenDistributeHits(2), [0, 8]);
    assert.deepEqual(evenDistributeHits(4), [0, 4, 8, 12]);
    assert.deepEqual(evenDistributeHits(8), [0, 2, 4, 6, 8, 10, 12, 14]);
    assert.equal(evenDistributeHits(16).length, 16);
  });

  it("derives bar and step duration from meter + BPM", () => {
    assert.equal(barDurationSec({ bpm: 120, meter: "4/4" }), 2);
    assert.equal(stepIntervalSec({ bpm: 120, meter: "4/4" }), 0.125);
    assert.equal(barDurationSec({ bpm: 120, meter: "3/4" }), 1.5);
  });

  it("inherits pad velocity from global unless the pad sets one", () => {
    assert.equal(resolvePadVelocity(100, undefined), 100);
    assert.equal(resolvePadVelocity(100, { velocity: null }), 100);
    assert.equal(resolvePadVelocity(80, { velocity: 110 }), 110);
    assert.equal(clampVelocity(400), 127);
    assert.equal(parseOptionalPadVelocity(""), null);
    assert.equal(parseOptionalPadVelocity(12), 12);
  });

  it("mixes kick forward and hats back from the global Vel", () => {
    assert.equal(mixPadVelocity(100, 36, 4), 114);
    assert.ok(mixPadVelocity(100, 42, 8) < mixPadVelocity(100, 36, 4));
    assert.ok(mixPadVelocity(100, 42, 16) < mixPadVelocity(100, 42, 8));
  });
});
