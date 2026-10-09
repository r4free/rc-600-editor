import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DrumHit, DrumScore, PlayedBar } from "./scoreDrumEvents.js";
import type { PartPlan } from "./sectionSuggest.js";
import { DEFAULT_CONVERT_OPTIONS, resolveParts } from "./exportPack.js";
import {
  MAX_USER_PATTERNS,
  RECORD_SIZE,
  buildUserPattern,
  decodeUserPattern,
  encodeUserPattern,
  isSupportedMeter,
  patternNames,
  readRhythmRc0,
  renameRecord,
  sanitizePatternName,
  upsertRecord,
  writeRhythmRc0,
} from "./rhythmRc0.js";

const PPQ = 960;

function bar(index: number, hits: DrumHit[]): PlayedBar {
  return {
    index,
    masterBarIndex: index,
    numerator: 4,
    denominator: 4,
    lengthTicks: PPQ * 4,
    tempo: 98.6,
    section: null,
    hits,
  };
}

const GROOVE: DrumHit[] = [
  { tick: 0, note: 36, velocity: 100 },
  { tick: PPQ, note: 38, velocity: 90 },
];
const FILL: DrumHit[] = [{ tick: PPQ * 3, note: 49, velocity: 110 }];

const SCORE: DrumScore = {
  title: "Test",
  artist: "",
  ppq: PPQ,
  tracks: [],
  trackIndices: [0],
  bars: [bar(0, GROOVE), bar(1, GROOVE), bar(2, FILL), bar(3, GROOVE)],
};

const PLAN: PartPlan = {
  intro: { role: "intro", start: 3, end: 4, confidence: "high", reason: "" },
  varA: { role: "varA", start: 0, end: 2, confidence: "high", reason: "" },
  fillA: { role: "fillA", start: 1, end: 3, confidence: "high", reason: "" },
};

describe("rhythmRc0", () => {
  it("lays parts end to end in pedal order and fills unset parts", () => {
    const p = buildUserPattern(resolveParts(SCORE, PLAN, DEFAULT_CONVERT_OPTIONS), { name: "Canção Teste Longa", kit: 3 });
    assert.equal(p.name, "Cancao Teste");
    assert.equal(p.tempo, 99);
    assert.equal(p.totalBars, 4);
    // Intro (1 bar) → bar 0, Var A (2 bars) → 1–2, Fill A narrowed to its last bar → 3.
    assert.deepEqual(p.phrases[0], { from: 0, bars: 1 });
    assert.deepEqual(p.phrases[1], { from: 1, bars: 2 });
    assert.deepEqual(p.phrases[2], { from: 3, bars: 1 });
    assert.deepEqual(p.phrases[3], { from: 1, bars: 2 }, "Var B falls back to Var A");
    assert.deepEqual(p.phrases[4], { from: 2, bars: 1 }, "Fill B falls back to Var A's last bar");
    assert.deepEqual(p.phrases[9], { from: 2, bars: 1 }, "Ending falls back to Var A's last bar");

    const total = p.seq.reduce((s, e) => s + e.delta, 0);
    assert.equal(total, 4 * 384, "deltas sum to whole bars at 96 PPQ");
    assert.deepEqual(p.seq.at(-1), { delta: 384 - 288, note: 0, velocity: 0 });
    assert.deepEqual(p.seq[0], { delta: 0, note: 36, velocity: 100 });
    assert.deepEqual(p.seq[1], { delta: 96, note: 38, velocity: 90 });
  });

  it("encodes the record layout the converter reads", () => {
    const p = buildUserPattern(resolveParts(SCORE, PLAN, DEFAULT_CONVERT_OPTIONS), { name: "ABC", kit: 5 });
    const raw = encodeUserPattern(p);
    assert.equal(raw.length, 40184);
    const view = new DataView(raw.buffer);
    assert.equal(String.fromCharCode(...raw.subarray(0, 3)), "ABC");
    assert.equal(raw[3], 0);
    assert.equal(view.getUint16(16, true), 5);
    assert.equal(view.getUint16(18, true), 99);
    assert.equal(raw[20], 4);
    assert.equal(raw[21], 4);
    assert.equal(view.getUint16(24 + 16 + 2, true), 2, "Var A bars");
    assert.equal(view.getUint16(24 + 4, true), 4, "totalBars on every phrase");
    assert.equal(view.getUint16(24 + 9 * 16 + 12, true), p.seq.length, "count on every phrase");
    assert.deepEqual(decodeUserPattern(raw), p);
  });

  it("round-trips the file and keeps untouched records byte-exact", () => {
    const a = encodeUserPattern(buildUserPattern(resolveParts(SCORE, PLAN, DEFAULT_CONVERT_OPTIONS), { name: "One", kit: 0 }));
    const b = encodeUserPattern(buildUserPattern(resolveParts(SCORE, PLAN, DEFAULT_CONVERT_OPTIONS), { name: "Two", kit: 1 }));
    const file = writeRhythmRc0([a]);
    assert.equal(file.length, 12 + MAX_USER_PATTERNS * RECORD_SIZE);
    assert.equal(String.fromCharCode(...file.subarray(0, 8)), "PTN_0000");
    assert.equal(new DataView(file.buffer).getUint32(8, true), RECORD_SIZE);

    const records = readRhythmRc0(file);
    assert.deepEqual(patternNames(records), ["One"]);
    const appended = upsertRecord(records, b, null);
    assert.equal(appended.index, 1);
    const replaced = upsertRecord(appended.records, b, 0);
    assert.deepEqual(patternNames(replaced.records), ["Two", "Two"]);
    assert.deepEqual(readRhythmRc0(writeRhythmRc0(appended.records))[0], a);
  });

  it("renames a record without touching the rest", () => {
    const a = encodeUserPattern(buildUserPattern(resolveParts(SCORE, PLAN, DEFAULT_CONVERT_OPTIONS), { name: "Long Name 12", kit: 2 }));
    const renamed = renameRecord(a, "Bossa");
    assert.equal(decodeUserPattern(renamed).name, "Bossa");
    assert.equal(renamed[5], 0, "old name bytes cleared");
    assert.deepEqual(renamed.subarray(16), a.subarray(16));
    assert.equal(decodeUserPattern(a).name, "Long Name 12", "original untouched");
  });

  it("validates names, meters and the file header", () => {
    assert.equal(sanitizePatternName("  "), "USER");
    assert.equal(sanitizePatternName("Ação™ 2"), "Acao? 2");
    assert.ok(isSupportedMeter(7, 4));
    assert.ok(isSupportedMeter(6, 8) && !isSupportedMeter(3, 8));
    assert.throws(() => readRhythmRc0(new Uint8Array(20)), /not an RC-600 rhythm/);
    assert.throws(
      () => buildUserPattern(resolveParts(SCORE, {}, DEFAULT_CONVERT_OPTIONS), { name: "x", kit: 0 }),
      /at least one variation/,
    );
  });
});
