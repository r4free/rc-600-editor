import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignSourceMidiCc } from "./params.js";
import {
  clampKitIndex,
  clampRhythmKitCc,
  findRhythmKitAssign,
  kitIndexToCcValue,
  resolveRhythmKitAssign,
  rhythmKitTargetValue,
} from "./rhythm-kit-midi.js";

describe("rhythm kit MIDI", () => {
  it("maps Assign Source values to MIDI CC numbers", () => {
    assert.equal(assignSourceMidiCc(46), 1);
    assert.equal(assignSourceMidiCc(49), 4);
    assert.equal(assignSourceMidiCc(77), 64);
    assert.equal(assignSourceMidiCc(0), null);
  });

  it("keeps Rhythm Kit immediately after Rhythm Variation (771)", () => {
    assert.equal(rhythmKitTargetValue(), 772);
  });

  it("reads an ON MIDI CC assign targeting Rhythm Kit", () => {
    const found = findRhythmKitAssign([
      { A: "1", B: "47", G: "772", D: "0", F: "15", H: "0", I: "15" },
    ]);
    assert.deepEqual(found, {
      cc: 2,
      actLow: 0,
      actHigh: 15,
      targetMin: 0,
      targetMax: 15,
    });
  });

  it("ignores off assigns and non-CC sources", () => {
    assert.equal(
      findRhythmKitAssign([
        { A: "0", B: "47", G: "772" },
        { A: "1", B: "0", G: "772" },
        { A: "1", B: "47", G: "771" },
      ]),
      null,
    );
  });

  it("maps kit index across 0–127 and 0–15 Act ranges", () => {
    assert.equal(kitIndexToCcValue(0), 0);
    assert.equal(kitIndexToCcValue(15), 127);
    assert.equal(kitIndexToCcValue(7), 59);
    assert.equal(
      kitIndexToCcValue(5, { actLow: 0, actHigh: 15, targetMin: 0, targetMax: 15 }),
      5,
    );
  });

  it("clamps kit and CC, and falls back when no assign exists", () => {
    assert.equal(clampKitIndex(99), 15);
    assert.equal(clampRhythmKitCc(2), 2);
    assert.equal(clampRhythmKitCc(40), 2);
    assert.equal(clampRhythmKitCc(70), 70);
    assert.equal(resolveRhythmKitAssign(null).cc, 2);
  });
});
