import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyStepDepth, lfoRateHz, stepDurationSec, stepValueToTarget, vibratoDelay } from "./stepPreview";

describe("vibrato preview", () => {
  it("maps step values to wobble depth in cents", () => {
    assert.equal(stepValueToTarget("vibrato", 0), 0);
    assert.equal(stepValueToTarget("vibrato", 100), 100);
  });

  it("scales the delay swing so Depth keeps a similar pitch bend at any Rate", () => {
    const slow = vibratoDelay(2, 100, 0);
    const fast = vibratoDelay(8, 100, 0);
    assert.ok(Math.abs(2 * Math.PI * 2 * slow.main - 2 * Math.PI * 8 * fast.main) < 1e-9);
    assert.equal(vibratoDelay(5, 0, 100).main, 0);
    assert.equal(vibratoDelay(5, 100, 0).color, 0);
    assert.ok(vibratoDelay(5, 100, 100).color > 0);
    assert.ok(vibratoDelay(0.5, 100, 0).main <= 0.015);
  });

  it("follows the effect Rate", () => {
    assert.equal(lfoRateHz(14, 120), 8);
    assert.equal(lfoRateHz(18, 120), 0.5);
  });
});

describe("step preview timing", () => {
  it("follows the BPM for note rates", () => {
    assert.equal(stepDurationSec(14, 120), 0.125);
    assert.equal(stepDurationSec(8, 120), 0.5);
    assert.equal(stepDurationSec(2, 60), 4);
  });

  it("maps free rates to steps per second", () => {
    assert.equal(stepDurationSec(18, 120), 2);
    assert.ok(Math.abs(stepDurationSec(118, 120) - 1 / 16) < 1e-9);
  });
});

describe("step preview targets", () => {
  it("maps step values per effect family", () => {
    assert.equal(stepValueToTarget("volume", 0), 0);
    assert.equal(stepValueToTarget("volume", 100), 1);
    assert.equal(stepValueToTarget("pan", 50), 0);
    assert.equal(stepValueToTarget("pan", 0), -1);
    assert.equal(stepValueToTarget("pitch", 50), 0);
    assert.equal(stepValueToTarget("pitch", 100), 1200);
    assert.equal(stepValueToTarget("filter", 0), 150);
    assert.ok(stepValueToTarget("filter", 100) > 10000);
    assert.equal(stepValueToTarget("volume", 140), 1);
  });

  it("mixes Step Slicer depth between dry and the programmed level", () => {
    assert.equal(applyStepDepth(0, 0), 100);
    assert.equal(applyStepDepth(0, 50), 50);
    assert.equal(applyStepDepth(0, 100), 0);
    assert.equal(applyStepDepth(40, 50), 70);
    assert.equal(applyStepDepth(75, 200), 75);
  });
});
