import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addTap, tapTempoBpm } from "./tapTempo";

describe("tap tempo", () => {
  it("needs two taps", () => {
    assert.equal(tapTempoBpm([1000], 40, 250), null);
  });

  it("averages the tap intervals", () => {
    assert.equal(tapTempoBpm([0, 500, 1000, 1500], 40, 250), 120);
    assert.equal(tapTempoBpm([0, 480, 1000], 40, 250), 120);
  });

  it("clamps to the range", () => {
    assert.equal(tapTempoBpm([0, 100], 40, 250), 250);
    assert.equal(tapTempoBpm([0, 2900], 40, 250), 40);
  });

  it("forgets old taps and keeps the last five", () => {
    assert.deepEqual(addTap([0, 500], 4000), [4000]);
    assert.deepEqual(addTap([100, 200, 300, 400, 500], 600), [200, 300, 400, 500, 600]);
  });
});
