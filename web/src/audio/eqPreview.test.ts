import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eqLabelHz, eqResponseDb } from "./eqPreview";

const FLAT = { lo: 0, loMid: 0, hiMid: 0, high: 0, level: 0, loMidHz: 800, loMidQ: 1, hiMidHz: 3150, hiMidQ: 1 };
const near = (a: number, b: number, tol = 0.3) => Math.abs(a - b) <= tol;

describe("EQ preview helpers", () => {
  it("reads band frequencies from the guide labels", () => {
    assert.equal(eqLabelHz("800 Hz", 0), 800);
    assert.equal(eqLabelHz("3.15 kHz", 0), 3150);
    assert.equal(eqLabelHz("20.0 Hz", 0), 20);
    assert.equal(eqLabelHz(undefined, 500), 500);
  });

  it("is flat at the defaults and follows Level everywhere", () => {
    for (const hz of [30, 800, 3150, 15000]) assert.ok(near(eqResponseDb(FLAT, hz), 0, 1e-6));
    assert.ok(near(eqResponseDb({ ...FLAT, level: -6 }, 1000), -6, 1e-6));
  });

  it("boosts each band where it acts and leaves the far end alone", () => {
    assert.ok(near(eqResponseDb({ ...FLAT, loMid: 12 }, 800), 12));
    assert.ok(near(eqResponseDb({ ...FLAT, loMid: 12 }, 15000), 0, 0.5));
    assert.ok(near(eqResponseDb({ ...FLAT, hiMid: -10, hiMidHz: 2000 }, 2000), -10));
    assert.ok(eqResponseDb({ ...FLAT, lo: 10 }, 25) > 8);
    assert.ok(eqResponseDb({ ...FLAT, high: 10 }, 18000) > 8);
    assert.ok(near(eqResponseDb({ ...FLAT, high: 10 }, 100), 0, 0.5));
  });

  it("narrows the band as Q goes up", () => {
    const wide = eqResponseDb({ ...FLAT, loMid: 12, loMidQ: 0.5 }, 1600);
    const narrow = eqResponseDb({ ...FLAT, loMid: 12, loMidQ: 8 }, 1600);
    assert.ok(wide > narrow + 3);
  });
});
