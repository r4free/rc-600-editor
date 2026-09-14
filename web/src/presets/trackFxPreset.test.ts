import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRACK_FX_CATEGORIES } from "@rc600/catalog/track-fx";
import { factoryTrackFxPresetCountByCategory } from "./trackFxFactoryCatalog.js";
import {
  FACTORY_TRACK_FX_PRESETS,
  matchTrackFxPreset,
  parseUserTrackFxPresets,
  upsertUserTrackFxPreset,
} from "./trackFxPreset.js";

describe("trackFxPreset", () => {
  it("builds a large factory library including Beat category", () => {
    assert.ok(FACTORY_TRACK_FX_PRESETS.length >= 170);
    const counts = factoryTrackFxPresetCountByCategory();
    assert.equal(counts.all, FACTORY_TRACK_FX_PRESETS.length);
    for (const cat of TRACK_FX_CATEGORIES) {
      if (cat === "Other") {
        assert.ok((counts[cat] ?? 0) >= 1, `${cat} should have at least THRU`);
        continue;
      }
      assert.ok((counts[cat] ?? 0) >= 8, `${cat} should have many presets, got ${counts[cat] ?? 0}`);
    }
    const ids = new Set(FACTORY_TRACK_FX_PRESETS.map((p) => p.id));
    assert.equal(ids.size, FACTORY_TRACK_FX_PRESETS.length);
    const scatter = FACTORY_TRACK_FX_PRESETS.find((p) => p.id === "factory-scatter-p3");
    assert.ok(scatter);
    assert.equal(scatter!.type, 52);
    assert.equal(scatter!.category, "Beat");
    assert.equal(scatter!.tags.A, "2");
  });

  it("parses and upserts user presets including Track-only types", () => {
    const parsed = parseUserTrackFxPresets([
      { id: "u1", name: "My Scatter", type: 52, category: "Beat", tags: { A: "0", B: "6" } },
      { id: "bad", name: "x", type: 99, tags: {} },
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.name, "My Scatter");
    const next = upsertUserTrackFxPreset(parsed, {
      id: "u2",
      name: "Vinyl Stop",
      category: "Beat",
      source: "user",
      type: 55,
      tags: { A: "8" },
    });
    assert.equal(next.length, 2);
  });

  it("filters by category and query", () => {
    const scatter = FACTORY_TRACK_FX_PRESETS.find((p) => p.id === "factory-scatter-p3")!;
    assert.equal(matchTrackFxPreset(scatter, "scatter", "all"), true);
    assert.equal(matchTrackFxPreset(scatter, "delay", "all"), false);
    assert.equal(matchTrackFxPreset(scatter, "", "Beat"), true);
    assert.equal(matchTrackFxPreset(scatter, "", "Delay"), false);
  });
});
