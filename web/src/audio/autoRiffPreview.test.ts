import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PHRASE_STEPS, phraseNotes, RIFF_PHRASES, scaleMidi } from "./autoRiffPreview.js";

describe("autoRiffPreview", () => {
  it("has 30 distinct 16-step phrases that start on a note", () => {
    assert.equal(RIFF_PHRASES.length, 30);
    for (const p of RIFF_PHRASES) {
      assert.equal(p.length, PHRASE_STEPS);
      assert.equal(typeof p[0], "number");
      assert.ok(p.every((t) => t === "-" || t === "." || Number.isInteger(t)));
    }
    assert.equal(new Set(RIFF_PHRASES.map((p) => p.join(" "))).size, 30);
  });

  it("merges held steps into the note before them and skips rests", () => {
    assert.deepEqual(phraseNotes(1).slice(0, 2), [
      { start: 0, length: 2, degree: 0 },
      { start: 2, length: 2, degree: 4 },
    ]);
    const p6 = phraseNotes(5);
    assert.deepEqual(p6.slice(0, 2), [
      { start: 0, length: 1, degree: 0 },
      { start: 2, length: 1, degree: 0 },
    ]);
    assert.deepEqual(p6.at(-1), { start: 12, length: 3, degree: 4 });
  });

  it("maps scale steps onto the major key", () => {
    assert.equal(scaleMidi(48, 0, 0), 48);
    assert.equal(scaleMidi(48, 0, 2), 52);
    assert.equal(scaleMidi(48, 0, 7), 60);
    assert.equal(scaleMidi(48, 0, -1), 47);
    assert.equal(scaleMidi(48, 5, 2), 60);
    assert.equal(scaleMidi(50, 4, 0), 57);
  });
});
