import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  barDurationSec,
  beatIntervalSec,
  clampBpm,
  evenDistributeHits,
  parseOptionalBpm,
  resolvePadTiming,
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
});
