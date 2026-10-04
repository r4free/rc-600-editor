import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formantRatio, robotMidi } from "./robotPreview";

describe("robot preview", () => {
  it("sings every syllable on the fixed Note (C3–B3)", () => {
    assert.equal(robotMidi(0), 48);
    assert.equal(robotMidi(11), 59);
    assert.equal(robotMidi(20), 59);
  });

  it("shifts the formants with Formant", () => {
    assert.equal(formantRatio(50), 1);
    assert.ok(Math.abs(formantRatio(0) - Math.SQRT1_2) < 1e-9);
    assert.ok(Math.abs(formantRatio(100) - Math.SQRT2) < 1e-9);
    assert.ok(formantRatio(30) < 1 && formantRatio(70) > 1);
  });
});
