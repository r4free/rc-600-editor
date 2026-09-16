import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { midiNoteName, scoreVoiceStateFromActiveBeats } from "./alphaTabVoice";

describe("alphaTab Voice Tone Match mapping", () => {
  it("extracts harmony and the highest active note from the selected vocal track", () => {
    const state = scoreVoiceStateFromActiveBeats([
      {
        chord: { name: "Am7" },
        notes: [{ realValue: 52 }],
        voice: { bar: { staff: { track: { index: 0 } } } },
      },
      {
        notes: [{ realValue: 69 }, { realValue: 72 }],
        voice: { bar: { staff: { track: { index: 2 } } } },
      },
    ], 2);
    assert.deepEqual(state, { chord: "Am7", targetMidi: 72 });
    assert.equal(midiNoteName(72), "C5");
  });

  it("falls back to chord-only guidance without a vocal track", () => {
    assert.deepEqual(scoreVoiceStateFromActiveBeats([
      { chord: { name: "G" }, notes: [{ realValue: 67 }] },
    ]), { chord: "G", targetMidi: null });
  });
});
