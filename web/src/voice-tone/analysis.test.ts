import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chordPitchClasses,
  classifyVoiceAgainstChord,
  classifyVoicePitch,
  initialVoiceStability,
  rollingCompatibility,
  updateVoiceStability,
} from "./analysis";

describe("Voice Tone Match analysis", () => {
  it("classifies scale degrees in major and minor keys", () => {
    assert.deepEqual(classifyVoicePitch(71, "G", "major"), {
      inKey: true,
      degree: "3rd",
      pitchClass: 11,
    });
    assert.equal(classifyVoicePitch(70, "G", "major").inKey, false);
    assert.equal(classifyVoicePitch(72, "A", "minor").degree, "Minor 3rd");
  });

  it("requires a stable note and clears stale voice input", () => {
    let state = initialVoiceStability();
    state = updateVoiceStability(state, 69, 1000);
    assert.equal(state.stableMidi, null);
    state = updateVoiceStability(state, 69, 1150);
    assert.equal(state.stableMidi, 69);
    state = updateVoiceStability(state, null, 1300);
    assert.equal(state.stableMidi, 69);
    state = updateVoiceStability(state, null, 1600);
    assert.equal(state.stableMidi, null);
  });

  it("does not immediately replace a stable note during a transition", () => {
    let state = updateVoiceStability(initialVoiceStability(), 69, 0);
    state = updateVoiceStability(state, 69, 200);
    state = updateVoiceStability(state, 71, 250);
    assert.equal(state.stableMidi, 69);
    state = updateVoiceStability(state, 71, 410);
    assert.equal(state.stableMidi, 71);
  });

  it("calculates rolling compatibility and removes old events", () => {
    const result = rollingCompatibility([
      { at: 1000, inKey: true },
      { at: 2000, inKey: false },
      { at: 11_000, inKey: true },
    ], 12_000, 5_000);
    assert.equal(result.percent, 100);
    assert.equal(result.events.length, 1);
  });

  it("classifies chord tones separately from other key tones", () => {
    assert.deepEqual([...chordPitchClasses("G7")], [7, 11, 2, 5]);
    assert.deepEqual(classifyVoiceAgainstChord(71, "G", "G", "major"), {
      inChord: true,
      label: "Chord tone",
    });
    assert.deepEqual(classifyVoiceAgainstChord(69, "G", "G", "major"), {
      inChord: false,
      label: "Key tone",
    });
    assert.equal(classifyVoiceAgainstChord(68, "G", "G", "major").label, "Outside key");
  });
});
