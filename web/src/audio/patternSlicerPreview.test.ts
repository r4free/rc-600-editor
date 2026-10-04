import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SLICE_PATTERNS, sliceEnvelope, sliceSpan } from "./patternSlicerPreview";

describe("pattern slicer preview rhythms", () => {
  it("has 20 distinct 16-slice patterns", () => {
    assert.equal(SLICE_PATTERNS.length, 20);
    assert.equal(new Set(SLICE_PATTERNS).size, 20);
    for (const p of SLICE_PATTERNS) assert.match(p, /^x[x.-]{15}$/);
  });

  it("starts, holds and skips slices per pattern", () => {
    assert.equal(sliceSpan(0, 3), 1);
    assert.equal(sliceSpan(1, 1), 0);
    assert.equal(sliceSpan(2, 0), 2);
    assert.equal(sliceSpan(2, 1), 0);
    assert.equal(sliceSpan(7, 0), 4);
  });
});

describe("pattern slicer preview envelope", () => {
  it("Duty sets how much of each slice sounds", () => {
    assert.equal(sliceEnvelope(0.2, 50, 35, 100).onSec, 0.1);
    assert.ok(sliceEnvelope(0.2, 99, 35, 100).onSec > sliceEnvelope(0.2, 10, 35, 100).onSec);
  });

  it("Attack trades a soft fade-in for a hard, accented start", () => {
    const soft = sliceEnvelope(0.2, 50, 0, 100);
    const hard = sliceEnvelope(0.2, 50, 100, 100);
    assert.ok(soft.rampSec > hard.rampSec);
    assert.ok(hard.peak > soft.peak);
    assert.equal(soft.peak, 1);
  });

  it("Depth sets how far the gaps drop", () => {
    assert.equal(sliceEnvelope(0.2, 50, 35, 100).floor, 0);
    assert.equal(sliceEnvelope(0.2, 50, 35, 0).floor, 1);
    assert.equal(sliceEnvelope(0.2, 50, 35, 40).floor, 0.6);
  });
});
