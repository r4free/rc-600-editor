import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DRUM_PRESET_CATEGORIES,
  inferDrumPresetCategory,
  normalizeDrumPresetCategory,
  resolveDrumPresetCategory,
} from "./drumCategories.js";

describe("drumCategories", () => {
  it("normalizes known labels and infers from the rhythm name", () => {
    assert.equal(normalizeDrumPresetCategory("Hip-Hop"), "Hip-Hop");
    assert.equal(normalizeDrumPresetCategory("hip-hop"), "Hip-Hop");
    assert.equal(normalizeDrumPresetCategory("nope"), null);
    assert.equal(inferDrumPresetCategory("Four on the Floor"), "Electronic");
    assert.equal(inferDrumPresetCategory("UK Garage"), "Electronic");
    assert.equal(inferDrumPresetCategory("Garage Rock"), "Rock");
    assert.equal(inferDrumPresetCategory("Blues Rock"), "Rock");
    assert.equal(inferDrumPresetCategory("Dubstep"), "Electronic");
    assert.equal(inferDrumPresetCategory("Dub"), "World");
    assert.equal(inferDrumPresetCategory("Rocksteady"), "World");
    assert.equal(inferDrumPresetCategory("Pop Punk"), "Punk");
    assert.equal(inferDrumPresetCategory("Default Kit"), "Practice");
    assert.equal(resolveDrumPresetCategory("Latin", "House"), "Latin");
    assert.equal(resolveDrumPresetCategory(undefined, "House"), "Electronic");
  });

  it("maps every factory-style name onto the closed category list", () => {
    const samples = [
      "Basic Rock",
      "Death Metal",
      "House",
      "Boom Bap",
      "Bossa Nova",
      "Reggae",
      "Motown",
      "Jazz Ride",
      "Bluegrass",
      "Dream Pop",
      "Click",
    ];
    for (const name of samples) {
      assert.ok(DRUM_PRESET_CATEGORIES.includes(inferDrumPresetCategory(name)));
    }
  });
});
