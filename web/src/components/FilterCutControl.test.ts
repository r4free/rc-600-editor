import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterBars } from "./FilterCutControl";

describe("filter cut mini equalizer", () => {
  it("shows every band passed when FLAT", () => {
    assert.ok(filterBars(5, null, true).every((b) => b.passed && b.height === 100));
  });

  it("slopes down below a low cut and above a high cut", () => {
    const low = filterBars(6, 3, true);
    assert.deepEqual(low.map((b) => b.passed), [false, false, false, true, true, true]);
    assert.ok(low[0]!.height < low[2]!.height);
    const high = filterBars(6, 2, false);
    assert.deepEqual(high.map((b) => b.passed), [true, true, true, false, false, false]);
    assert.ok(high[5]!.height < high[3]!.height);
    assert.ok(high.every((b) => b.height >= 10));
  });
});
