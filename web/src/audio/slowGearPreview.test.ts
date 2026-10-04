import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slowGearRiseSec, slowGearTriggers } from "./slowGearPreview.js";

describe("slowGearPreview", () => {
  it("maps Rise Time from a fast to a slow swell", () => {
    assert.equal(slowGearRiseSec(0), 0.05);
    assert.ok(Math.abs(slowGearRiseSec(50) - (0.05 + 0.5 ** 1.5 * 2.5)) < 1e-9);
    assert.ok(Math.abs(slowGearRiseSec(100) - 2.55) < 1e-9);
    assert.ok(slowGearRiseSec(30) < slowGearRiseSec(70));
  });

  it("lets softer picks start a swell as Sens rises", () => {
    assert.equal(slowGearTriggers(1, 0), true);
    assert.equal(slowGearTriggers(0.45, 0), false);
    assert.equal(slowGearTriggers(0.45, 50), false);
    assert.equal(slowGearTriggers(0.45, 70), true);
    assert.equal(slowGearTriggers(0.25, 100), true);
  });
});
