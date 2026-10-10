import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTO_MAP_MAX, autoMapOptions, summarizePlan } from "./autoMap.js";
import type { DrumHit, PlayedBar } from "../../web/src/rhythmConverter/scoreDrumEvents.js";

const PPQ = 960;
const S16 = PPQ / 4;

function hits(spec: [number, number][]): DrumHit[] {
  return spec.map(([step, note]) => ({ tick: step * S16, note, velocity: 100 }));
}

const ROCK = hits([
  [0, 36], [0, 42], [2, 42], [4, 38], [4, 42], [6, 42],
  [8, 36], [8, 42], [10, 42], [12, 38], [12, 42], [14, 42],
]);
const CHORUS = hits([
  [0, 36], [0, 51], [2, 51], [4, 38], [4, 51], [6, 36], [6, 51],
  [8, 36], [8, 51], [10, 51], [12, 38], [12, 51], [14, 51],
]);
const FILL = hits([[0, 38], [2, 38], [4, 48], [6, 48], [8, 45], [10, 45], [12, 41], [14, 41]]);
const STICKS = hits([[0, 37], [4, 37], [8, 37], [12, 37]]);
const CRASH = hits([[0, 49], [0, 36]]);

function song(parts: DrumHit[][]): PlayedBar[] {
  return parts.map((h, index) => ({
    index,
    masterBarIndex: index,
    numerator: 4,
    denominator: 4,
    lengthTicks: PPQ * 4,
    tempo: 120,
    section: null,
    hits: h,
  }));
}

const r = (n: number, bar: DrumHit[]) => Array.from({ length: n }, () => bar);

describe("autoMapOptions", () => {
  const bars = song([
    ...r(2, STICKS),
    ...r(7, ROCK),
    FILL,
    ...r(7, CHORUS),
    FILL,
    ...r(7, ROCK),
    FILL,
    CRASH,
  ]);

  it("fills intro, variations, fills and ending without markers", () => {
    const [best] = autoMapOptions(bars, PPQ);
    assert.ok(best);
    const { plan } = best;
    assert.deepEqual([plan.intro?.start, plan.intro?.end], [0, 2]);
    assert.ok(plan.varA && plan.varB);
    assert.ok(plan.fillA || plan.fillB);
    assert.equal(plan.ending?.end, bars.length);
    const grooves = [plan.varA, plan.varB].map((p) => bars[p!.start]!.hits);
    assert.ok(grooves.includes(ROCK) && grooves.includes(CHORUS));
  });

  it("returns up to eight distinct options, best first", () => {
    const options = autoMapOptions(bars, PPQ);
    assert.ok(options.length > 1 && options.length <= AUTO_MAP_MAX);
    for (let i = 1; i < options.length; i++) assert.ok(options[i - 1]!.score >= options[i]!.score);
    const keys = new Set(options.map((o) => JSON.stringify(o.plan)));
    assert.equal(keys.size, options.length);
  });

  it("returns nothing for a song without drums", () => {
    assert.deepEqual(autoMapOptions(song([[], []]), PPQ), []);
  });

  it("summarizes a plan", () => {
    const [best] = autoMapOptions(bars, PPQ);
    assert.match(summarizePlan(best!.plan), /variation.*fill/);
  });
});
