import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatChordTimeline,
  parseChordTimeline,
  timelinePositionAt,
} from "./chordTimeline";

describe("setlist chord timeline", () => {
  it("parses one-chord bars and explicit beat durations", () => {
    assert.deepEqual(parseChordTimeline("| C | G/B | Am:2 F:2 | G |", 4), [
      { chord: "C", beats: 4 },
      { chord: "G/B", beats: 4 },
      { chord: "Am", beats: 2 },
      { chord: "F", beats: 2 },
      { chord: "G", beats: 4 },
    ]);
  });

  it("formats a timeline for editing", () => {
    assert.equal(formatChordTimeline([
      { chord: "C", beats: 4, line: 1 },
      { chord: "Am", beats: 2, line: 2 },
      { chord: "F", beats: 2, line: 2 },
    ]), "| C~1 | Am:2~2 F:2~2 |");
    assert.deepEqual(parseChordTimeline("| C~1 | Am:2~2 F:2~2 |"), [
      { chord: "C", beats: 4, line: 1 },
      { chord: "Am", beats: 2, line: 2 },
      { chord: "F", beats: 2, line: 2 },
    ]);
  });

  it("finds the active chord from BPM and elapsed time", () => {
    const timeline = [
      { chord: "C", beats: 4, line: 1, section: "Verse" },
      { chord: "G", beats: 4, line: 2, section: "Chorus" },
    ];
    assert.equal(timelinePositionAt(timeline, 1, 120).chord, "C");
    const second = timelinePositionAt(timeline, 2.5, 120);
    assert.equal(second.chord, "G");
    assert.equal(second.line, 2);
    assert.equal(second.section, "Chorus");
    assert.equal(second.beatsRemainingInChord, 3);
    assert.equal(second.bar, 2);
    assert.equal(timelinePositionAt(timeline, 4, 120).done, true);
  });
});
