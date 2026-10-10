import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DrumHit, PlayedBar } from "../../web/src/rhythmConverter/scoreDrumEvents.js";
import { barFingerprint, roleAtBar } from "../../web/src/rhythmConverter/sectionSuggest.js";
import { classifySection, loopLength, suggestParts } from "./suggest.js";

const PPQ = 960;
const S16 = PPQ / 4;

function hits(spec: [number, number][]): DrumHit[] {
  return spec.map(([step, note]) => ({ tick: step * S16, note, velocity: 100 }));
}

const ROCK = hits([
  [0, 36], [0, 42], [2, 42], [4, 38], [4, 42], [6, 42],
  [8, 36], [8, 42], [10, 42], [12, 38], [12, 42], [14, 42],
]);
const ROCK_B = hits([
  [0, 36], [0, 42], [2, 42], [4, 38], [4, 42], [6, 36], [6, 42],
  [8, 36], [8, 42], [10, 42], [12, 38], [12, 42], [14, 42],
]);
const CHORUS = hits([
  [0, 36], [0, 51], [2, 51], [4, 38], [4, 51], [6, 36], [6, 51],
  [8, 36], [8, 51], [10, 51], [12, 38], [12, 51], [14, 51],
]);
const FILL = hits([
  [0, 38], [2, 38], [4, 48], [6, 48], [8, 45], [10, 45], [12, 41], [14, 41],
]);
const CRASH = hits([[0, 49], [0, 36]]);

function song(parts: [DrumHit[], string?][]): PlayedBar[] {
  return parts.map(([h, section], index) => ({
    index,
    masterBarIndex: index,
    numerator: 4,
    denominator: 4,
    lengthTicks: PPQ * 4,
    tempo: 120,
    section: section ?? null,
    hits: h,
  }));
}

describe("classifySection", () => {
  it("maps English and Portuguese names", () => {
    assert.equal(classifySection("Intro"), "intro");
    assert.equal(classifySection("Verse 2"), "verse");
    assert.equal(classifySection("Refrão"), "chorus");
    assert.equal(classifySection("Pré-Refrão"), "pre");
    assert.equal(classifySection("Ponte"), "bridge");
    assert.equal(classifySection("Outro"), "ending");
    assert.equal(classifySection("Virada"), "fill");
    assert.equal(classifySection(null), "other");
  });
});

describe("loopLength", () => {
  it("finds 1- and 2-bar loops", () => {
    const one = song([[ROCK], [ROCK], [ROCK], [ROCK]]).map((b) => barFingerprint(b, PPQ));
    assert.equal(loopLength(one, 0, 4), 1);
    const two = song([[ROCK], [CHORUS], [ROCK], [CHORUS]]).map((b) => barFingerprint(b, PPQ));
    assert.equal(loopLength(two, 0, 4), 2);
  });
});

describe("suggestParts", () => {
  it("uses section markers for intro, variations, fills and ending", () => {
    const bars = song([
      [CRASH, "Intro"], [ROCK],
      [ROCK, "Verse"], [ROCK], [ROCK], [FILL],
      [CHORUS, "Chorus"], [CHORUS], [CHORUS], [FILL],
      [ROCK, "Verse 2"], [ROCK],
      [CRASH, "Outro"],
    ]);
    const plan = suggestParts(bars, PPQ);
    assert.deepEqual([plan.intro?.start, plan.intro?.end], [0, 2]);
    assert.deepEqual([plan.varA?.start, plan.varA?.end], [2, 3]);
    assert.deepEqual([plan.fillA?.start, plan.fillA?.end], [5, 6]);
    assert.deepEqual([plan.varB?.start, plan.varB?.end], [6, 7]);
    assert.deepEqual([plan.fillB?.start, plan.fillB?.end], [9, 10]);
    assert.equal(plan.varC, undefined, "repeated verse is not a new variation");
    assert.deepEqual([plan.ending?.start, plan.ending?.end], [12, 13]);
    assert.equal(plan.varA?.confidence, "high");
  });

  it("clusters grooves when there are no markers", () => {
    const bars = song([
      [CRASH],
      [ROCK], [ROCK_B], [ROCK], [ROCK_B], [FILL],
      [CHORUS], [CHORUS], [CHORUS], [FILL],
      [CRASH],
    ]);
    const plan = suggestParts(bars, PPQ);
    assert.deepEqual([plan.intro?.start, plan.intro?.end], [0, 1]);
    assert.equal(plan.varA?.start, 1);
    assert.equal(plan.varB?.start, 6);
    assert.equal(plan.fillA?.start, 5);
    assert.equal(plan.fillB?.start, 9);
    assert.deepEqual([plan.ending?.start, plan.ending?.end], [10, 11]);
    assert.equal(plan.varA?.confidence, "medium");
  });

  it("falls back to the first bar with drums", () => {
    const plan = suggestParts(song([[[]], [FILL]]), PPQ);
    assert.equal(plan.varA?.start, 1);
    assert.equal(plan.varA?.confidence, "low");
  });

  it("returns nothing without drum hits", () => {
    assert.deepEqual(suggestParts(song([[[]]]), PPQ), {});
  });

  it("reports the role shown on a bar", () => {
    const plan = suggestParts(song([[CRASH, "Intro"], [ROCK, "Verse"], [ROCK]]), PPQ);
    assert.equal(roleAtBar(plan, 0), "intro");
    assert.equal(roleAtBar(plan, 1), "varA");
    assert.equal(roleAtBar(plan, 2), null);
  });
});
