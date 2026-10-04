import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shelfDb, sustainerSettings } from "./sustainerPreview";

describe("sustainer preview settings", () => {
  it("Sustain compresses harder and adds more make-up gain", () => {
    const low = sustainerSettings(50, 50, 0);
    const high = sustainerSettings(50, 50, 100);
    assert.ok(high.thresholdDb < low.thresholdDb);
    assert.ok(high.ratio > low.ratio);
    assert.ok(high.makeupDb > low.makeupDb);
  });

  it("Attack lets more of the pick through and Release holds the gain longer", () => {
    assert.ok(sustainerSettings(100, 50, 50).attackSec > sustainerSettings(0, 50, 50).attackSec);
    assert.ok(sustainerSettings(50, 100, 50).releaseSec > sustainerSettings(50, 0, 50).releaseSec);
  });

  it("Low / Hi Gain raw 0–40 maps to −20…+20 dB", () => {
    assert.equal(shelfDb(0), -20);
    assert.equal(shelfDb(20), 0);
    assert.equal(shelfDb(40), 20);
  });
});
