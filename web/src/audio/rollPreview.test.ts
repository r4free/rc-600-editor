import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inputFxTypeParams } from "@rc600/catalog/input-fx";
import { rollSlices } from "../components/RollSplitPicker";
import { rollFeedback, rollMix, rollSliceSec, rollTimeSec } from "./rollPreview";

describe("roll preview", () => {
  it("follows the tempo for note values and uses 10 ms steps for free values", () => {
    assert.equal(rollTimeSec(2, 120), 2);
    assert.equal(rollTimeSec(18 + 25, 120), 0.25);
    assert.equal(rollTimeSec(18, 120), 0.001);
  });

  it("splits the cycle by Roll", () => {
    assert.deepEqual([0, 1, 2, 3, 4].map(rollSlices), [1, 2, 4, 8, 16]);
    assert.equal(rollSliceSec(2, 0, 120), 2);
    assert.equal(rollSliceSec(2, 3, 120), 0.25);
  });

  it("holds the slice with Roll on or INF, otherwise fades by Feedback / Repeat", () => {
    assert.equal(rollFeedback(10, 2, false), 1);
    assert.equal(rollFeedback(100, 0, true), 1);
    assert.ok(rollFeedback(100, 0, false) < 1);
    assert.ok(rollFeedback(80, 0, false) > rollFeedback(20, 0, false));
  });

  it("blends direct and roll with Balance", () => {
    assert.deepEqual(rollMix(50), { dry: 1, wet: 1 });
    assert.deepEqual(rollMix(0), { dry: 1, wet: 0 });
    assert.deepEqual(rollMix(100), { dry: 0, wet: 1 });
  });

  it("names the repetitions Feedback on Roll 1 and Repeat on Roll 2", () => {
    assert.equal(inputFxTypeParams(45)[1]?.name, "Feedback");
    assert.equal(inputFxTypeParams(46)[1]?.name, "Repeat");
  });
});
