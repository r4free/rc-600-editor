import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIST_PEDALS, knobAngle } from "../components/DistPedalPicker";
import { clipSample, DIST_TYPES, distDrive, distToneHz } from "./distPreview";

describe("dist preview", () => {
  it("has one voicing and one pedal per Type option", () => {
    assert.deepEqual(
      DIST_TYPES.map((t) => t.name),
      ["VOCAL", "BOOST", "OD", "DS", "METAL", "FUZZ"],
    );
    assert.equal(DIST_PEDALS.length, DIST_TYPES.length);
  });

  it("drives harder as Dist rises, and METAL harder than BOOST", () => {
    for (let type = 0; type < DIST_TYPES.length; type++) {
      assert.ok(distDrive(type, 100) > distDrive(type, 50));
      assert.ok(distDrive(type, 50) > distDrive(type, 0));
    }
    assert.ok(distDrive(4, 50) > distDrive(1, 50) * 10);
    assert.equal(distDrive(2, 0), 2);
    assert.equal(distDrive(2, 100), 20);
  });

  it("keeps every clipping shape within ±1", () => {
    for (const shape of ["soft", "hard", "fuzz"] as const) {
      for (const x of [-50, -2, -0.5, 0.5, 2, 50]) assert.ok(Math.abs(clipSample(x, shape)) <= 1);
    }
    assert.equal(clipSample(0, "soft"), 0);
    assert.equal(clipSample(0, "fuzz"), 0);
  });

  it("maps Tone to a darker or brighter cutoff, 3.5 kHz at 0", () => {
    assert.equal(distToneHz(50), 3500);
    assert.ok(distToneHz(0) < 1300);
    assert.ok(distToneHz(100) > 10000);
  });

  it("turns pedal knobs from −135° to +135°", () => {
    assert.equal(knobAngle(0), -135);
    assert.equal(knobAngle(50), 0);
    assert.equal(knobAngle(100), 135);
  });
});
