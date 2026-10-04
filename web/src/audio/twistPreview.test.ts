import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inputFxTypeParams } from "@rc600/catalog/input-fx";
import { TWIST_RATE_HZ, twistFallSec, twistRiseSec } from "./twistPreview";

describe("twist preview", () => {
  it("maps Rise and Fall to 0.1–4 s", () => {
    assert.equal(twistRiseSec(0), 0.1);
    assert.ok(Math.abs(twistRiseSec(100) - 4) < 1e-9);
    assert.ok(twistRiseSec(50) > twistRiseSec(25));
    assert.equal(twistFallSec(70), twistRiseSec(70));
  });

  it("speeds the rotation up", () => {
    assert.ok(TWIST_RATE_HZ[1] > TWIST_RATE_HZ[0] * 10);
  });

  it("offers only FALL and FADE for Release, as in the Parameter Guide", () => {
    const release = inputFxTypeParams(44).find((d) => d.name === "Release");
    assert.deepEqual(
      release?.options?.map((o) => o.label),
      ["FALL", "FADE"],
    );
  });
});
