import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoHarmonyMidi, degreeMidi, manualHarmonyMidi } from "./harmonyPreview";

describe("harmony preview", () => {
  it("places scale degrees in the key", () => {
    assert.equal(degreeMidi(0, 0), 60);
    assert.equal(degreeMidi(0, 2), 64);
    assert.equal(degreeMidi(0, 7), 72);
    assert.equal(degreeMidi(0, -2), 57);
    assert.equal(degreeMidi(7, 0), 67);
  });

  it("adds diatonic intervals for HRM MANUAL", () => {
    // Voices: OCT-, OCT+, -6TH, -5TH, -4TH, -3RD, +3RD, +4TH, +5TH, +6TH, UNISON
    assert.equal(manualHarmonyMidi(0, 0, 6), 64);
    assert.equal(manualHarmonyMidi(0, 2, 6), 67);
    assert.equal(manualHarmonyMidi(0, 1, 6), 65);
    assert.equal(manualHarmonyMidi(0, 0, 5), 57);
    assert.equal(manualHarmonyMidi(0, 0, 0), 48);
    assert.equal(manualHarmonyMidi(0, 0, 1), 72);
    assert.equal(manualHarmonyMidi(0, 0, 10), 60);
    assert.equal(manualHarmonyMidi(0, 0, 9), 69);
  });

  it("picks chord notes around the melody for HRM AUTO", () => {
    // Voices: OCT-, OCT+, LOWER, LOW, HIGH, HIGHER, UNISON; C major chord (root degree 0)
    assert.equal(autoHarmonyMidi(0, 0, 0, 4), 64);
    assert.equal(autoHarmonyMidi(0, 0, 0, 5), 67);
    assert.equal(autoHarmonyMidi(0, 0, 0, 3), 55);
    assert.equal(autoHarmonyMidi(0, 0, 0, 2), 52);
    // A minor chord (degree 5) under a sung C: next chord note above is E.
    assert.equal(autoHarmonyMidi(0, 0, 5, 4), 64);
    assert.equal(autoHarmonyMidi(0, 0, 5, 3), 57);
  });
});
