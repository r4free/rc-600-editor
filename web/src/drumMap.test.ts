import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PAD_NOTES,
  DEFAULT_RHYTHM_CHANNEL,
  GM_DRUM_INSTRUMENTS,
  clampDrumNote,
  clampMidiChannel,
  drumLabelForNote,
  encodeAllNotesOff,
  encodeChannelSilence,
  encodeNoteOff,
  encodeNoteOn,
  encodeNoteRelease,
  parseRhythmChannel,
} from "./drumMap.js";

describe("drumMap", () => {
  it("has 16 default pad slots and a GM instrument catalog", () => {
    assert.equal(DEFAULT_PAD_NOTES.length, 16);
    assert.equal(new Set(DEFAULT_PAD_NOTES).size, 16);
    assert.ok(DEFAULT_PAD_NOTES.includes(36));
    assert.ok(DEFAULT_PAD_NOTES.includes(38));
    assert.ok(GM_DRUM_INSTRUMENTS.length >= 16);
    assert.equal(drumLabelForNote(36), "Kick");
    assert.equal(drumLabelForNote(38), "Snare");
    assert.equal(clampDrumNote(200), 127);
  });

  it("parses Rx Rhythm CH (factory 10 → 9)", () => {
    assert.equal(parseRhythmChannel(undefined), DEFAULT_RHYTHM_CHANNEL);
    assert.equal(parseRhythmChannel(""), 9);
    assert.equal(parseRhythmChannel(10), 9);
    assert.equal(parseRhythmChannel(9), 8);
    assert.equal(parseRhythmChannel("10"), 9);
    assert.equal(parseRhythmChannel("Ch.10"), 9);
    assert.equal(parseRhythmChannel("Ch.1"), 0);
    assert.equal(parseRhythmChannel(1), 0);
    assert.equal(clampMidiChannel(20), 15);
  });

  it("encodes Note On / Note Off on the given channel", () => {
    assert.deepEqual(encodeNoteOn(9, 36, 100), [0x99, 36, 100]);
    assert.deepEqual(encodeNoteOff(9, 36), [0x99, 36, 0]);
    assert.deepEqual(encodeNoteRelease(9, 36), [
      [0x89, 36, 0],
      [0x99, 36, 0],
    ]);
    assert.deepEqual(encodeNoteOn(0, 38, 127), [0x90, 38, 127]);
  });

  it("encodes channel silence (sustain / all sound / all notes off)", () => {
    assert.deepEqual(encodeChannelSilence(0), [
      [0xb0, 64, 0],
      [0xb0, 120, 0],
      [0xb0, 123, 0],
    ]);
    assert.deepEqual(encodeAllNotesOff(9), [0xb9, 123, 0]);
  });

  it("clamps velocity and note ranges", () => {
    assert.deepEqual(encodeNoteOn(9, 200, 0), [0x99, 127, 1]);
    assert.deepEqual(encodeNoteOn(20, -1, 200), [0x9f, 0, 127]);
  });
});
