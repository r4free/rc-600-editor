import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as alphaTab from "@coderline/alphatab";
import { dominantMeter, extractDrumScore, resolveTrackSelection } from "./scoreDrumEvents.js";

const TEX = [
  '\\title "Test Song"',
  '\\track "Guitar" (0.6).1 |',
  '\\track "Drums" \\instrument percussion \\tempo 100 .',
  '\\section "Intro" (49 36).2 (38).2 |',
  '\\section "Verse" \\ro \\rc 2 (36 42).8 (42).8 (38 42).8 (42).8 (36 42).8 (42).8 (38 42).8 (42).8',
].join(" ");

function loadTex(tex: string): any {
  return alphaTab.importer.ScoreLoader.loadAlphaTex(tex);
}

describe("extractDrumScore", () => {
  it("detects the drum track and expands repeats into played bars", () => {
    const score = extractDrumScore(alphaTab, loadTex(TEX));
    assert.equal(score.title, "Test Song");
    assert.equal(score.tracks.length, 2);
    assert.deepEqual(score.trackIndices, [1]);
    assert.equal(score.bars.length, 3);
    assert.deepEqual(
      score.bars.map((b) => b.masterBarIndex),
      [0, 1, 1],
    );
    assert.equal(score.bars[0]!.section, "Intro");
    assert.equal(score.bars[1]!.section, "Verse");
    assert.equal(score.bars[0]!.tempo, 100);
    assert.equal(score.bars[0]!.lengthTicks, score.ppq * 4);
  });

  it("keeps bar-relative hit ticks with GM drum notes", () => {
    const score = extractDrumScore(alphaTab, loadTex(TEX));
    const verse = score.bars[2]!;
    assert.equal(verse.hits.length, 12);
    assert.deepEqual(
      verse.hits.filter((h) => h.note === 38).map((h) => h.tick),
      [score.ppq, score.ppq * 3],
    );
    assert.ok(verse.hits.every((h) => h.tick >= 0 && h.tick < verse.lengthTicks));
  });

  it("can switch to another track", () => {
    const score = extractDrumScore(alphaTab, loadTex(TEX), [0]);
    assert.deepEqual(score.trackIndices, [0]);
    assert.equal(score.bars[0]!.hits.length, 1);
  });

  it("merges several tracks in time order and ignores invalid picks", () => {
    const score = extractDrumScore(alphaTab, loadTex(TEX), [1, 0, 1, 9]);
    assert.deepEqual(score.trackIndices, [0, 1]);
    const intro = score.bars[0]!;
    assert.equal(intro.hits.length, 1 + 3);
    assert.ok(intro.hits.every((h, i) => i === 0 || intro.hits[i - 1]!.tick <= h.tick));
    assert.deepEqual(extractDrumScore(alphaTab, loadTex(TEX), [9]).trackIndices, [1], "falls back to the drum track");
  });

  it("reports the dominant meter", () => {
    const score = extractDrumScore(alphaTab, loadTex(TEX));
    assert.equal(dominantMeter(score.bars), "4/4");
  });
});

describe("resolveTrackSelection", () => {
  const tracks = [
    { index: 0, name: "Guitar", isPercussion: false, noteCount: 300 },
    { index: 1, name: "Drums", isPercussion: true, noteCount: 900 },
    { index: 2, name: "Bass", isPercussion: false, noteCount: 200 },
    { index: 3, name: "Percussion", isPercussion: true, noteCount: 120 },
    { index: 4, name: "Empty Kit", isPercussion: true, noteCount: 0 },
  ];

  it("merges every percussion track with notes by default", () => {
    assert.deepEqual(resolveTrackSelection(tracks), [1, 3]);
    assert.deepEqual(resolveTrackSelection(tracks, [99]), [1, 3]);
  });

  it("keeps an explicit pick", () => {
    assert.deepEqual(resolveTrackSelection(tracks, [3]), [3]);
  });
});
