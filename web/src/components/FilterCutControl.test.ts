import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterBarColor, filterBars, shelfBars } from "./FilterCutControl";

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

  it("draws Low / Hi Gain as a shelf: flat at 0 dB, raised or dipped at the shelved end", () => {
    assert.ok(shelfBars(0, true).every((b) => b.height === 50 && !b.shaped));
    const boostLow = shelfBars(20, true);
    assert.ok(boostLow[0]!.height > 90 && boostLow[0]!.shaped);
    assert.ok(Math.abs(boostLow.at(-1)!.height - 50) <= 1 && !boostLow.at(-1)!.shaped);
    const cutHigh = shelfBars(-20, false);
    assert.ok(cutHigh.at(-1)!.height < 10 && cutHigh.at(-1)!.shaped);
    assert.ok(Math.abs(cutHigh[0]!.height - 50) <= 1);
  });

  it("colors the bands from yellow to orange", () => {
    assert.equal(filterBarColor(0, 29), "hsl(50 95% 56%)");
    assert.equal(filterBarColor(28, 29), "hsl(24 95% 52%)");
  });
});
