import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chorusSettings, cutLabelHz, GUITAR_PROGRESSION, pluckString } from "./chorusPreview";

describe("chorus preview helpers", () => {
  it("reads cut filter labels as Hz, FLAT as no filter", () => {
    assert.equal(cutLabelHz("20.0 Hz"), 20);
    assert.equal(cutLabelHz("800 Hz"), 800);
    assert.equal(cutLabelHz("1.25 kHz"), 1250);
    assert.equal(cutLabelHz("12.5 kHz"), 12500);
    assert.equal(cutLabelHz("FLAT"), null);
    assert.equal(cutLabelHz(undefined), null);
  });

  it("maps Depth to the delay sweep and tames it at fast rates", () => {
    assert.equal(chorusSettings(0, 1).sweepSec, 0);
    assert.equal(chorusSettings(100, 1).sweepSec, 0.004);
    assert.ok(chorusSettings(100, 6).sweepSec < chorusSettings(100, 1).sweepSec);
    assert.ok(chorusSettings(100, 1).sweepSec < chorusSettings(100, 1).delaySec);
  });

  it("plucks a decaying string at the requested pitch", () => {
    const sr = 8000;
    const out = new Float32Array(sr);
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    pluckString(out, sr, 200, 100, 1, rand);
    assert.equal(out[50], 0);
    const energy = (from: number, to: number) => out.slice(from, to).reduce((s, v) => s + v * v, 0);
    assert.ok(energy(100, 1100) > energy(7000, 8000) * 4);
    assert.equal(GUITAR_PROGRESSION.length, 4);
  });
});
