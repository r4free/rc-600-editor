import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PartEvents } from "./exportPack.js";
import { rhythmPlayback, rhythmSequence, segmentAt } from "./previewPlayer.js";

function part(role: PartEvents["role"], bars: number): PartEvents {
  return {
    role,
    notes: Array.from({ length: bars }, (_, i) => ({ tick: i * 1920, note: 36 + i, velocity: 100, duration: 60 })),
    lengthTicks: 1920 * bars,
    tempoBpm: 90,
    numerator: 4,
    denominator: 4,
    bars,
  };
}

describe("rhythm player sequence", () => {
  it("orders parts like the pedal and repeats only variations", () => {
    assert.deepEqual(rhythmSequence(["ending", "fillA", "varB", "varA", "intro"], 3), [
      { role: "intro", times: 1 },
      { role: "varA", times: 3 },
      { role: "fillA", times: 1 },
      { role: "varB", times: 3 },
      { role: "ending", times: 1 },
    ]);
  });

  it("lays parts end to end at one tempo, with fills cut to their last bar", () => {
    const pb = rhythmPlayback([part("varA", 2), part("fillA", 2)], rhythmSequence(["varA", "fillA"], 2), {
      tempoBpm: 120,
      loop: false,
    })!;
    // 120 BPM: one 4/4 bar = 2000 ms. Two passes of a 2-bar variation, then one fill bar.
    assert.deepEqual(
      pb.segments!.map((s) => [s.role, s.startMs, s.lengthMs, s.pass]),
      [
        ["varA", 0, 4000, 1],
        ["varA", 4000, 4000, 2],
        ["fillA", 8000, 2000, 1],
      ],
    );
    assert.equal(pb.lengthMs, 10000);
    assert.equal(pb.loop, false);
    assert.deepEqual(
      pb.hits.filter((h) => h.ms >= 8000).map((h) => [h.ms, h.note]),
      [[8000, 37]],
    );
    const at = segmentAt(pb, 9000)!;
    assert.equal(at.segment.role, "fillA");
    assert.equal(at.within, 0.5);
  });

  it("returns null when no picked part is set", () => {
    assert.equal(rhythmPlayback([part("varA", 1)], rhythmSequence(["varB"], 1), { tempoBpm: 100, loop: true }), null);
  });
});
