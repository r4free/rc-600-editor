import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intervalName, transposedNote } from "./TransposeKeys";

describe("transpose keyboard labels", () => {
  it("names the interval and direction", () => {
    assert.equal(intervalName(0), "No change");
    assert.equal(intervalName(7), "Perfect 5th up");
    assert.equal(intervalName(-3), "Minor 3rd down");
    assert.equal(intervalName(12), "Octave up");
    assert.equal(intervalName(-12), "Octave down");
  });

  it("finds the note reached from C", () => {
    assert.equal(transposedNote(0), "C");
    assert.equal(transposedNote(7), "G");
    assert.equal(transposedNote(-2), "Bb");
    assert.equal(transposedNote(12), "C");
  });
});
