import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inputFxTypeParams } from "@rc600/catalog/input-fx";
import { warpLevelGain } from "./warpPreview";

describe("warp preview", () => {
  it("plays the effect at unity gain for Level 50", () => {
    assert.equal(warpLevelGain(0), 0);
    assert.equal(warpLevelGain(50), 1);
    assert.equal(warpLevelGain(100), 2);
    assert.equal(warpLevelGain(150), 2);
  });

  it("has a single Level parameter, default 50", () => {
    const params = inputFxTypeParams(43);
    assert.deepEqual(params.map((d) => [d.name, d.default]), [["Level", 50]]);
  });
});
