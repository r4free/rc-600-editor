import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lofiBits, lofiHold, quantize } from "./lofiPreview";

describe("lo-fi preview mapping", () => {
  it("Bit Depth raw runs OFF, 31 bits … 1 bit", () => {
    assert.equal(lofiBits(0), 0);
    assert.equal(lofiBits(1), 31);
    assert.equal(lofiBits(24), 8);
    assert.equal(lofiBits(31), 1);
  });

  it("Sample Rate raw runs OFF, 1/2 … 1/32", () => {
    assert.equal(lofiHold(0), 1);
    assert.equal(lofiHold(1), 2);
    assert.equal(lofiHold(3), 4);
    assert.equal(lofiHold(31), 32);
  });

  it("fewer bits round samples to coarser steps", () => {
    assert.equal(quantize(0.3, 0), 0.3);
    assert.equal(quantize(0.3, 1), 0);
    assert.equal(quantize(0.3, 2), 0.5);
    assert.ok(Math.abs(quantize(0.3, 16) - 0.3) < 1e-4);
  });
});
