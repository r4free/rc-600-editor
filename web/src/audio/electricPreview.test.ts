import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { electricGlideSec, electricThreshold, nearestScaleNote, scaleNotes } from "./electricPreview";

describe("electric preview", () => {
  it("snaps to every semitone or to the key's notes", () => {
    assert.equal(scaleNotes(0).length, 12);
    assert.deepEqual(scaleNotes(1), [0, 2, 4, 5, 7, 9, 11]);
    assert.deepEqual(scaleNotes(8), [0, 2, 4, 6, 7, 9, 11]);
  });

  it("finds the nearest allowed note", () => {
    assert.equal(nearestScaleNote(64.4, scaleNotes(0)), 64);
    assert.equal(nearestScaleNote(60.9, scaleNotes(1)), 60);
    assert.equal(nearestScaleNote(61.6, scaleNotes(1)), 62);
    assert.equal(nearestScaleNote(66.1, scaleNotes(1)), 67);
    assert.equal(nearestScaleNote(65.9, scaleNotes(1)), 65);
  });

  it("jumps faster as Speed rises and holds longer as Stability rises", () => {
    assert.ok(electricGlideSec(10) < electricGlideSec(5));
    assert.ok(electricGlideSec(5) < electricGlideSec(0));
    assert.equal(electricThreshold(10), 0.5);
    assert.ok(electricThreshold(20) > electricThreshold(10));
    assert.ok(electricThreshold(0) < electricThreshold(10));
  });
});
