import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DrumHit, DrumScore, PlayedBar } from "./scoreDrumEvents.js";
import type { PartPlan } from "./sectionSuggest.js";
import {
  DEFAULT_CONVERT_OPTIONS,
  buildPartEvents,
  mapToKit,
  meterMismatches,
  resolveParts,
  songSlug,
} from "./exportPack.js";

const PPQ = 960;

function bar(index: number, hits: DrumHit[], meter: [number, number] = [4, 4]): PlayedBar {
  return {
    index,
    masterBarIndex: index,
    numerator: meter[0],
    denominator: meter[1],
    lengthTicks: (PPQ * 4 * meter[0]) / meter[1],
    tempo: 98.6,
    section: null,
    hits,
  };
}

const GROOVE: DrumHit[] = [
  { tick: 0, note: 36, velocity: 100 },
  { tick: PPQ + 7, note: 38, velocity: 90 },
  { tick: PPQ * 2 - 5, note: 42, velocity: 70 },
  { tick: PPQ * 3, note: 38, velocity: 90 },
];
const FILL: DrumHit[] = [
  { tick: 0, note: 33, velocity: 60 },
  { tick: PPQ * 2, note: 48, velocity: 110 },
  { tick: PPQ * 3, note: 92, velocity: 100 },
];

function score(bars: PlayedBar[]): DrumScore {
  return { title: "Canção Teste", artist: "", ppq: PPQ, tracks: [], trackIndices: [0], bars };
}

const PLAN: PartPlan = {
  varA: { role: "varA", start: 0, end: 2, confidence: "high", reason: "" },
  fillA: { role: "fillA", start: 2, end: 3, confidence: "high", reason: "" },
};

describe("mapToKit", () => {
  it("keeps kit notes, remaps GP extras and drops the rest", () => {
    assert.equal(mapToKit(38, true), 38);
    assert.equal(mapToKit(92, true), 46);
    assert.equal(mapToKit(33, true), null);
    assert.equal(mapToKit(33, false), 33);
  });
});

describe("buildPartEvents", () => {
  const s = score([bar(0, GROOVE), bar(1, GROOVE), bar(2, FILL)]);

  it("concatenates bars at 480 PPQ and quantizes to the grid", () => {
    const part = buildPartEvents(s, PLAN, "varA", DEFAULT_CONVERT_OPTIONS)!;
    assert.equal(part.lengthTicks, 480 * 4 * 2);
    assert.equal(part.bars, 2);
    assert.equal(part.tempoBpm, 99);
    assert.deepEqual(
      part.notes.map((n) => [n.tick, n.note]),
      [[0, 36], [480, 38], [960, 42], [1440, 38], [1920, 36], [2400, 38], [2880, 42], [3360, 38]],
    );
  });

  it("keeps raw timing when quantize is off and scales velocity", () => {
    const part = buildPartEvents(s, PLAN, "varA", {
      ...DEFAULT_CONVERT_OPTIONS,
      quantize: "off",
      velocityScale: 150,
    })!;
    assert.equal(part.notes[1]!.tick, Math.round((PPQ + 7) / 2));
    assert.equal(part.notes[0]!.velocity, 127);
  });

  it("builds a half-bar fill from the variation groove", () => {
    const full = buildPartEvents(s, PLAN, "fillA", DEFAULT_CONVERT_OPTIONS)!;
    assert.deepEqual(full.notes.map((n) => n.note), [48, 46]);
    const half = buildPartEvents(s, PLAN, "fillA", { ...DEFAULT_CONVERT_OPTIONS, fillLength: "half" })!;
    assert.deepEqual(half.notes.map((n) => [n.tick, n.note]), [[0, 36], [480, 38], [960, 42], [960, 48], [1440, 46]]);
    assert.equal(half.lengthTicks, 1920);
  });

  it("humanize is deterministic", () => {
    const opts = { ...DEFAULT_CONVERT_OPTIONS, humanize: true };
    assert.deepEqual(buildPartEvents(s, PLAN, "varA", opts), buildPartEvents(s, PLAN, "varA", opts));
  });

  it("returns null for empty parts", () => {
    assert.equal(buildPartEvents(s, PLAN, "intro", DEFAULT_CONVERT_OPTIONS), null);
  });
});

describe("meterMismatches", () => {
  it("lists parts outside the chosen meter", () => {
    const s = score([bar(0, GROOVE), bar(1, GROOVE, [3, 4]), bar(2, FILL)]);
    assert.deepEqual(meterMismatches(s, PLAN, "4/4"), ["varA"]);
  });
});

describe("resolveParts", () => {
  it("lets overrides replace or add parts without a score", () => {
    const s = score([bar(0, GROOVE), bar(1, GROOVE), bar(2, FILL)]);
    const fill = buildPartEvents(s, PLAN, "fillA", DEFAULT_CONVERT_OPTIONS)!;
    const parts = resolveParts(null, {}, DEFAULT_CONVERT_OPTIONS, { fillB: { ...fill, origin: "library" } });
    assert.deepEqual(parts.map((p) => p.role), ["fillB"]);
    const mixed = resolveParts(s, PLAN, DEFAULT_CONVERT_OPTIONS, { varA: fill });
    assert.deepEqual(mixed.map((p) => [p.role, p.bars]), [["varA", 1], ["fillA", 1]]);
  });

  it("slugs from the file name when the score has no title", () => {
    assert.equal(songSlug({ title: "" }, "My Song.gp5"), "My_Song");
  });
});
