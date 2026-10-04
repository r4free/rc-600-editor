import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bassMidi, G2B_RIFF, g2bMix } from "./g2bPreview.js";

describe("g2bPreview", () => {
  it("blends guitar and bass with equal power", () => {
    assert.deepEqual(g2bMix(0), { dry: 1, wet: 0 });
    const mid = g2bMix(50);
    assert.ok(Math.abs(mid.dry - mid.wet) < 1e-9);
    assert.ok(Math.abs(mid.dry ** 2 + mid.wet ** 2 - 1) < 1e-9);
    const full = g2bMix(140);
    assert.ok(full.dry < 1e-9 && full.wet === 1);
  });

  it("plays the riff an octave lower as bass", () => {
    assert.equal(bassMidi(52), 40);
    assert.equal(G2B_RIFF.length, 16);
    assert.ok(G2B_RIFF.some((n) => n === null));
  });
});
