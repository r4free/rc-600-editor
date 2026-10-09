import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeVlq, writeSmf0 } from "./smfWriter.js";
import { extractMidiDrumScore, isMidiFile, parseMidiFile } from "./midiDrumScore.js";

const PPQ = 480;
const BAR = PPQ * 4;

function chunk(id: string, body: number[]): number[] {
  const n = body.length;
  return [...[...id].map((c) => c.charCodeAt(0)), n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...body];
}

function meta(delta: number, type: number, data: number[]): number[] {
  return [...encodeVlq(delta), 0xff, type, ...encodeVlq(data.length), ...data];
}

const text = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Format 1: conductor track (name, tempo, 4/4, markers, 3/4 at bar 3) + bass on ch 1 + drums on ch 10 with running status. */
function formatOneFile(): Uint8Array {
  const conductor = [
    ...meta(0, 0x03, text("My Song")),
    ...meta(0, 0x51, [0x07, 0xa1, 0x20]), // 120 BPM
    ...meta(0, 0x58, [4, 2, 24, 8]),
    ...meta(0, 0x06, text("Verse")),
    ...meta(BAR * 2, 0x06, text("Chorus")),
    ...meta(0, 0x58, [3, 2, 24, 8]),
    ...meta(0, 0x2f, []),
  ];
  const bass = [...meta(0, 0x03, text("Bass")), 0, 0x90, 40, 100, ...encodeVlq(PPQ), 0x80, 40, 0, ...meta(0, 0x2f, [])];
  const drums = [
    ...meta(0, 0x03, text("Drums")),
    0, 0x99, 36, 100, // kick, bar 1
    ...encodeVlq(PPQ), 38, 90, // running status snare
    ...encodeVlq(0), 38, 0, // note off as velocity 0
    ...encodeVlq(BAR * 2 - PPQ), 0x99, 49, 110, // crash on bar 3 (3/4)
    ...meta(0, 0x2f, []),
  ];
  return new Uint8Array([
    ...chunk("MThd", [0, 1, 0, 3, (PPQ >> 8) & 255, PPQ & 255]),
    ...chunk("MTrk", conductor),
    ...chunk("MTrk", bass),
    ...chunk("MTrk", drums),
  ]);
}

describe("midiDrumScore", () => {
  it("detects MIDI by extension or header", () => {
    assert.ok(isMidiFile("x.MID", new Uint8Array()));
    assert.ok(isMidiFile("x.bin", new Uint8Array(text("MThd"))));
    assert.ok(!isMidiFile("x.gp", new Uint8Array(text("PK"))));
  });

  it("reads a format-1 file: tracks per channel, markers, meters, running status", () => {
    const src = parseMidiFile(formatOneFile());
    assert.equal(src.title, "My Song");
    assert.equal(src.ppq, PPQ);
    const score = extractMidiDrumScore(src);
    assert.deepEqual(
      score.tracks.map((t) => [t.name, t.isPercussion, t.noteCount]),
      [
        ["Bass (Ch 1)", false, 1],
        ["Drums (Ch 10)", true, 3],
      ],
    );
    assert.deepEqual(score.trackIndices, [2 * 16 + 9]);
    assert.equal(score.bars.length, 3);
    assert.deepEqual(score.bars.map((b) => [b.numerator, b.lengthTicks, b.section]), [
      [4, BAR, "Verse"],
      [4, BAR, null],
      [3, PPQ * 3, "Chorus"],
    ]);
    assert.equal(Math.round(score.bars[0]!.tempo), 120);
    assert.deepEqual(score.bars[0]!.hits, [
      { tick: 0, note: 36, velocity: 100 },
      { tick: PPQ, note: 38, velocity: 90 },
    ]);
    assert.deepEqual(score.bars[2]!.hits, [{ tick: 0, note: 49, velocity: 110 }]);

    const bass = extractMidiDrumScore(src, [1 * 16 + 0]);
    assert.equal(bass.bars[0]!.hits[0]!.note, 40);

    const merged = extractMidiDrumScore(src, [2 * 16 + 9, 1 * 16 + 0]);
    assert.deepEqual(merged.trackIndices, [16, 41]);
    assert.deepEqual(
      merged.bars[0]!.hits.map((h) => h.note),
      [36, 40, 38],
      "notes from both tracks, in time order",
    );
  });

  it("reads files from our own SMF writer (format 0)", () => {
    const bytes = writeSmf0({
      name: "Groove",
      tempoBpm: 90,
      numerator: 6,
      denominator: 8,
      lengthTicks: PPQ * 3 * 2,
      notes: [
        { tick: 0, note: 36, velocity: 100, duration: 60 },
        { tick: PPQ * 3, note: 38, velocity: 80, duration: 60 },
      ],
    });
    const score = extractMidiDrumScore(parseMidiFile(bytes));
    assert.equal(score.bars.length, 2);
    assert.equal(score.bars[0]!.denominator, 8);
    assert.equal(Math.round(score.bars[1]!.tempo), 90);
    assert.deepEqual(score.bars[1]!.hits, [{ tick: 0, note: 38, velocity: 80 }]);
  });

  it("rejects non-MIDI and SMPTE files", () => {
    assert.throws(() => parseMidiFile(new Uint8Array(20)), /Not a Standard MIDI File/);
    const smpte = new Uint8Array([...chunk("MThd", [0, 0, 0, 1, 0xe7, 0x28])]);
    assert.throws(() => parseMidiFile(smpte), /SMPTE/);
  });
});
