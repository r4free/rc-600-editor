import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preampCurve } from "./preampPreview";

describe("preamp preview distortion", () => {
  it("builds a bounded monotonic clipping curve", () => {
    const curve = preampCurve(0.8, 4, 257);
    assert.equal(curve.length, 257);
    assert.ok(curve.every((value) => value >= -1 && value <= 1));
    for (let index = 1; index < curve.length; index++) {
      assert.ok(curve[index]! >= curve[index - 1]!);
    }
  });

  it("adds more saturation as the drive rises", () => {
    const clean = preampCurve(0, 0, 257);
    const driven = preampCurve(1, 0, 257);
    const sample = 160;
    assert.ok(Math.abs(driven[sample]!) > Math.abs(clean[sample]!));
  });
});
