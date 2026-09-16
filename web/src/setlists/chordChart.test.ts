import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseChord,
  parseSongMusic,
  scalePitchClasses,
  suggestKeys,
  transposeChord,
  transposeSongSource,
} from "./chordChart";

describe("setlist chord charts", () => {
  it("parses common ChordPro metadata, sections, lyrics, and chords", () => {
    const parsed = parseSongMusic(
      "chart",
      [
        "{title: Test Song}",
        "{key: G}",
        "{tempo: 120}",
        "{start_of_verse: Verse 1}",
        "[G]Hello [D/F#]world",
        "{end_of_verse}",
      ].join("\n"),
    );
    assert.equal(parsed.metadata.title, "Test Song");
    assert.equal(parsed.metadata.key, "G");
    assert.deepEqual(parsed.chords, ["G", "D/F#"]);
    assert.deepEqual(parsed.lines[0], { kind: "section", label: "Verse 1" });
    assert.equal(parsed.lines[1]?.kind, "lyrics");
  });

  it("parses chord qualities, extensions, and slash bass notes", () => {
    assert.deepEqual(parseChord("Bbmaj7/D"), {
      root: "Bb",
      quality: "maj7",
      bass: "D",
    });
    assert.deepEqual(parseChord("F♯m7"), {
      root: "F#",
      quality: "m7",
    });
    assert.equal(parseChord("not-a-chord"), null);
  });

  it("transposes chart and progression sources without changing lyrics", () => {
    assert.equal(
      transposeSongSource("chart", "{key: G}\n[G]Hello [D/F#]world", 2, "G"),
      "{key: A}\n[A]Hello [E/G#]world",
    );
    assert.equal(transposeSongSource("chords", "| Bb | F/A | Gm7 |", 2, "Bb"), "| C | G/B | Am7 |");
    assert.equal(transposeChord("C#m7/G#", -2, false), "Bm7/F#");
  });

  it("extracts chord-only progressions and suggests plausible keys", () => {
    const parsed = parseSongMusic("chords", "G | D | Em | C");
    assert.deepEqual(parsed.chords, ["G", "D", "Em", "C"]);
    const suggestions = suggestKeys(parsed.chords);
    assert.equal(suggestions[0]?.root, "G");
    assert.equal(suggestions[0]?.mode, "major");
  });

  it("provides major and minor pitch-class sets", () => {
    assert.deepEqual([...scalePitchClasses("C", "major")], [0, 2, 4, 5, 7, 9, 11]);
    assert.deepEqual([...scalePitchClasses("A", "minor")], [9, 11, 0, 2, 4, 5, 7]);
  });
});
