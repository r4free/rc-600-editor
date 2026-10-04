import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { freezeMix, freezeSustainLevel, freezeTimeSec } from "./freezePreview";

describe("freeze preview helpers", () => {
  it("maps Attack / Decay / Release to 20 ms – 3 s, growing with the value", () => {
    assert.ok(Math.abs(freezeTimeSec(0) - 0.02) < 1e-9);
    assert.ok(Math.abs(freezeTimeSec(100) - 3) < 1e-9);
    assert.ok(freezeTimeSec(30) < freezeTimeSec(70));
    assert.equal(freezeTimeSec(-5), freezeTimeSec(0));
  });

  it("keeps the held sound audible at Sustain 0 and at full at 100", () => {
    assert.equal(freezeSustainLevel(0), 0.2);
    assert.equal(freezeSustainLevel(100), 1);
    assert.ok(freezeSustainLevel(30) < freezeSustainLevel(60));
  });

  it("blends direct and frozen sound with both at full in the middle", () => {
    assert.deepEqual(freezeMix(0), [1, 0]);
    assert.deepEqual(freezeMix(50), [1, 1]);
    assert.deepEqual(freezeMix(100), [0, 1]);
  });
});
