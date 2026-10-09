import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RHYTHM_KITS } from "../../../src/catalog/params.js";
import { RC600_KIT_MODELS, kitModel } from "./kitModels.js";

describe("RC-600 kit models", () => {
  it("has one model per pedal kit, on a kit the bundled SoundFont has", () => {
    assert.equal(RC600_KIT_MODELS.length, RHYTHM_KITS.length);
    for (const m of RC600_KIT_MODELS) assert.ok([0, 8, 32, 40].includes(m.program));
  });

  it("falls back to Studio for an unknown kit", () => {
    assert.equal(kitModel(99), RC600_KIT_MODELS[0]);
    assert.equal(kitModel(7).program, 40, "Brush uses the brush samples");
  });
});
