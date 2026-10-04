import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { densityFill, gateCutSec, reverbImpulse, type ReverbShape } from "./reverbPreview";

const SR = 1000;
const base: ReverbShape = { kind: "reverb", timeSec: 2, density: 10, threshold: 50, gateTimeSec: 0.5 };

function energy(data: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = Math.floor(from * data.length); i < Math.floor(to * data.length); i++) sum += data[i]! ** 2;
  return sum;
}

describe("reverb preview impulse", () => {
  it("lasts Time seconds and decays for Reverb", () => {
    const [left, right] = reverbImpulse(base, SR);
    assert.equal(left!.length, 2 * SR);
    assert.equal(right!.length, 2 * SR);
    assert.ok(energy(left!, 0, 0.25) > energy(left!, 0.75, 1) * 50);
  });

  it("gets sparser at low Density", () => {
    const count = (d: number) => reverbImpulse({ ...base, density: d }, SR)[0]!.filter((v) => v !== 0).length;
    assert.ok(count(1) < count(10) / 20);
    assert.equal(densityFill(10), 1);
    assert.ok(densityFill(1) < 0.01);
  });

  it("cuts Gate Reverb earlier as Threshold rises", () => {
    assert.equal(gateCutSec(2, 0), 2);
    assert.equal(gateCutSec(2, 50), 1);
    assert.ok(gateCutSec(2, 100) <= 0.02);
    const len = (thr: number) => reverbImpulse({ ...base, kind: "gate", threshold: thr }, SR)[0]!.length;
    assert.ok(len(80) < len(20));
  });

  it("swells in over Gate Time for Reverse Reverb", () => {
    const [left] = reverbImpulse({ ...base, kind: "reverse", gateTimeSec: 0.8 }, SR);
    assert.equal(left!.length, 0.8 * SR);
    assert.ok(energy(left!, 0.7, 0.95) > energy(left!, 0, 0.25));
  });
});
