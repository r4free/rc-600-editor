import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DrumScore, PlayedBar } from "./scoreDrumEvents.js";
import { partPlayback, songPlayback } from "./previewPlayer.js";

const PPQ = 960;

function bar(index: number, tempo: number, hits: PlayedBar["hits"]): PlayedBar {
  return { index, masterBarIndex: index, numerator: 4, denominator: 4, lengthTicks: PPQ * 4, tempo, section: null, hits };
}

const SCORE: DrumScore = {
  title: "",
  artist: "",
  ppq: PPQ,
  tracks: [],
  trackIndices: [0],
  bars: [
    bar(0, 120, [{ tick: 0, note: 36, velocity: 100 }]),
    bar(1, 60, [{ tick: PPQ, note: 92, velocity: 80 }]),
  ],
};

describe("previewPlayer timing", () => {
  it("plays the song with each bar's tempo and remaps Guitar Pro extras", () => {
    const pb = songPlayback(SCORE);
    assert.equal(pb.loop, false);
    assert.deepEqual(pb.barStartsMs?.map(Math.round), [0, 2000]);
    assert.equal(Math.round(pb.lengthMs), 2000 + 4000);
    assert.deepEqual(
      pb.hits.map((h) => ({ ...h, ms: Math.round(h.ms) })),
      [
        { ms: 0, note: 36, velocity: 100 },
        { ms: 3000, note: 46, velocity: 80 },
      ],
    );
    const fromSecond = songPlayback(SCORE, 1);
    assert.equal(fromSecond.firstBar, 1);
    assert.equal(Math.round(fromSecond.hits[0]!.ms), 1000);
  });

  it("loops a part at its tempo", () => {
    const pb = partPlayback({
      role: "varA",
      notes: [{ tick: 480, note: 38, velocity: 90, duration: 60 }],
      lengthTicks: 1920,
      tempoBpm: 120,
      numerator: 4,
      denominator: 4,
      bars: 1,
    });
    assert.equal(pb.loop, true);
    assert.equal(Math.round(pb.lengthMs), 2000);
    assert.equal(Math.round(pb.hits[0]!.ms), 500);
  });
});
