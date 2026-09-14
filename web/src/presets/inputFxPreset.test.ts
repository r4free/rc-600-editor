import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INPUT_FX_CATEGORIES } from "@rc600/catalog/input-fx";
import { factoryPresetCountByCategory } from "./inputFxFactoryCatalog.js";
import {
  FACTORY_INPUT_FX_PRESETS,
  matchInputFxPreset,
  parseUserInputFxPresets,
  upsertUserInputFxPreset,
} from "./inputFxPreset.js";

describe("inputFxPreset", () => {
  it("builds a large curated factory library across categories", () => {
    assert.ok(FACTORY_INPUT_FX_PRESETS.length >= 150);
    const counts = factoryPresetCountByCategory();
    assert.equal(counts.all, FACTORY_INPUT_FX_PRESETS.length);
    for (const cat of INPUT_FX_CATEGORIES) {
      if (cat === "Other") {
        assert.ok((counts[cat] ?? 0) >= 1, `${cat} should have at least THRU`);
        continue;
      }
      assert.ok((counts[cat] ?? 0) >= 8, `${cat} should have many presets, got ${counts[cat] ?? 0}`);
    }
    const ids = new Set(FACTORY_INPUT_FX_PRESETS.map((p) => p.id));
    assert.equal(ids.size, FACTORY_INPUT_FX_PRESETS.length);
    const preamp = FACTORY_INPUT_FX_PRESETS.find((p) => p.id === "factory-preamp-combo");
    assert.ok(preamp);
    assert.equal(preamp!.type, 23);
    assert.equal(preamp!.category, "Amp");
    assert.equal(preamp!.tags.A, "3");
  });

  it("parses and upserts user presets", () => {
    const parsed = parseUserInputFxPresets([
      { id: "u1", name: "My Preamp", type: 23, category: "Amp", tags: { A: "1", C: "60" } },
      { id: "bad", name: "x", type: 99, tags: {} },
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.name, "My Preamp");
    const next = upsertUserInputFxPreset(parsed, {
      id: "u2",
      name: "Bright",
      category: "Amp",
      source: "user",
      type: 23,
      tags: { A: "0" },
    });
    assert.equal(next.length, 2);
  });

  it("filters by category and query", () => {
    const preamp = FACTORY_INPUT_FX_PRESETS.find((p) => p.id === "factory-preamp-combo")!;
    assert.equal(matchInputFxPreset(preamp, "combo", "all"), true);
    assert.equal(matchInputFxPreset(preamp, "delay", "all"), false);
    assert.equal(matchInputFxPreset(preamp, "", "Amp"), true);
    assert.equal(matchInputFxPreset(preamp, "", "Delay"), false);
  });
});
