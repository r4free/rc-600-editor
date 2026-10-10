import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyBars, grooveFeatures, suggestKit } from "./grooveClassify.js";
import type { DrumHit, PlayedBar } from "./scoreDrumEvents.js";
import { barRepeats } from "./sectionSuggest.js";

const PPQ = 480;
const Q = PPQ;
const E = PPQ / 2;

function bar(index: number, hits: DrumHit[], extra: Partial<PlayedBar> = {}): PlayedBar {
  return { index, masterBarIndex: index, numerator: 4, denominator: 4, lengthTicks: PPQ * 4, tempo: 100, section: null, hits, ...extra };
}

const h = (tick: number, note: number, velocity = 100): DrumHit => ({ tick, note, velocity });

/** Kick 1 & 3, snare 2 & 4, straight eighth hats. */
const rock = (i: number) =>
  bar(i, [h(0, 36), h(2 * Q, 36), h(Q, 38), h(3 * Q, 38), ...Array.from({ length: 8 }, (_, k) => h(k * E, 42))]);

/** Toms down the bar plus a crash. */
const tomFill = (i: number) =>
  bar(i, [h(0, 36), ...Array.from({ length: 12 }, (_, k) => h(k * (Q / 4) + Q, k < 4 ? 50 : k < 8 ? 47 : 43))]);

describe("barRepeats", () => {
  it("points identical bars at the first one and counts them", () => {
    const song = [rock(0), tomFill(1), rock(2), rock(3), tomFill(4), bar(5, [])];
    song[3] = { ...song[3]!, hits: song[3]!.hits.map((x) => ({ ...x, velocity: 60 })) };
    const { firstOf, count } = barRepeats(song, PPQ);
    assert.deepEqual(firstOf, [0, 1, 0, 0, 1, 5]);
    assert.equal(count.get(0), 3);
    assert.equal(count.get(1), 2);
  });
});

describe("classifyBars", () => {
  it("calls a steady backbeat groove a variation with rock tags", () => {
    const song = Array.from({ length: 16 }, (_, i) => rock(i));
    const g = classifyBars(song, 4, 8, PPQ);
    assert.equal(g.kind, "variation");
    assert.ok(g.tags.includes("Pop Rock"));
    assert.ok(g.tags.includes("Straight"));
    assert.ok(g.tags.includes("Medium"));
  });

  it("spots a tom fill", () => {
    const song = Array.from({ length: 16 }, (_, i) => (i === 7 ? tomFill(i) : rock(i)));
    assert.equal(classifyBars(song, 7, 8, PPQ).kind, "fill");
  });

  it("uses the first and last drum bars for intro and ending", () => {
    const song = [bar(0, []), ...Array.from({ length: 15 }, (_, i) => rock(i + 1))];
    assert.equal(classifyBars(song, 1, 3, PPQ).kind, "intro");
    assert.equal(classifyBars(song, 14, 16, PPQ).kind, "ending");
  });

  it("trusts section markers", () => {
    const song = Array.from({ length: 16 }, (_, i) => rock(i));
    song[8] = { ...song[8]!, section: "Outro" };
    assert.equal(classifyBars(song, 9, 11, PPQ).kind, "ending");
  });

  it("tags a triplet hi-hat groove as shuffle", () => {
    const T = Q / 3;
    const shuffle = (i: number) =>
      bar(i, [h(0, 36), h(2 * Q, 36), h(Q, 38), h(3 * Q, 38), ...[0, 1, 2, 3].flatMap((b) => [h(b * Q, 42), h(b * Q + 2 * T, 42)])]);
    const song = Array.from({ length: 8 }, (_, i) => shuffle(i));
    assert.ok(classifyBars(song, 2, 6, PPQ).tags.includes("Shuffle"));
  });
});

describe("suggestKit", () => {
  const kitFor = (bars: PlayedBar[]) => suggestKit(grooveFeatures(bars, PPQ)).kit;
  const withTempo = (b: PlayedBar, tempo: number) => ({ ...b, tempo });

  it("picks Rock for a straight backbeat and Light for a ballad", () => {
    assert.equal(kitFor([0, 1, 2, 3].map((i) => withTempo(rock(i), 128))), 4);
    assert.equal(kitFor([0, 1, 2, 3].map((i) => withTempo(rock(i), 70))), 2);
  });

  it("picks Dance / Techno for four-on-the-floor kicks", () => {
    const disco = (i: number, tempo: number) =>
      bar(i, [0, 1, 2, 3].map((k) => h(k * Q, 36)).concat(h(Q, 38), h(3 * Q, 38)), { tempo });
    assert.equal(kitFor([0, 1, 2].map((i) => disco(i, 120))), 11);
    assert.equal(kitFor([0, 1, 2].map((i) => disco(i, 135))), 12);
  });

  it("picks Jazz for swing on the ride", () => {
    const swing = (i: number) =>
      bar(i, [0, 1, 2, 3].flatMap((k) => [h(k * Q, 51), h(k * Q + (2 * Q) / 3, 51)]).concat(h(Q, 44), h(3 * Q, 44)), { tempo: 160 });
    assert.equal(kitFor([0, 1, 2, 3].map(swing)), 6);
  });
});
