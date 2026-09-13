import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseDrumPresetCatalog } from "./drumPreset.js";
import { DRUM_PRESET_CATEGORIES } from "./drumCategories.js";
import { DEFAULT_KIT_ID, parseDrumKitCatalog } from "./drumKit.js";

const catalogPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/play-drum/presets.json",
);

describe("factory rhythm catalog", () => {
  it("loads a large unique English factory library", () => {
    const raw = JSON.parse(readFileSync(catalogPath, "utf8").replace(/^\uFEFF/, ""));
    const list = parseDrumPresetCatalog(raw, "native");
    assert.ok(list.length >= 150, `expected at least 150 factory rhythms, got ${list.length}`);
    const ids = new Set(list.map((p) => p.id));
    const names = new Set(list.map((p) => p.name.toLowerCase()));
    assert.equal(ids.size, list.length);
    assert.equal(names.size, list.length);
    assert.ok(list.every((p) => /^[\x20-\x7E]+$/.test(p.name)), "factory names must be English ASCII");
    const looping = list.flatMap((p) =>
      Object.values(p.payload.overrides).filter((ov) => (ov.hitsPerBar ?? 0) > 0),
    );
    assert.ok(looping.length > 0);
    assert.ok(
      looping.every((ov) => ov.velocity != null && ov.velocity >= 1 && ov.velocity <= 127),
      "looping pads must bake a pad velocity",
    );
    assert.ok(
      list.every((p) => (DRUM_PRESET_CATEGORIES as readonly string[]).includes(p.category)),
      "every factory rhythm must have a known category",
    );
    assert.ok(new Set(list.map((p) => p.category)).size >= 8, "factory library should span many categories");
    assert.ok(
      list.every((p) => p.kitId && p.kitId.length > 0),
      "every factory rhythm must link to a kit",
    );
  });

  it("ships factory kits with distinct pad layouts", () => {
    const catalogPathKits = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../public/play-drum/kits.json",
    );
    const raw = JSON.parse(readFileSync(catalogPathKits, "utf8").replace(/^\uFEFF/, ""));
    const kits = parseDrumKitCatalog(raw, "native");
    assert.ok(kits.length >= 8, `expected factory kits, got ${kits.length}`);
    assert.ok(kits.some((k) => k.id === DEFAULT_KIT_ID && k.padCount === 16));
    assert.ok(kits.some((k) => k.padCount === 8));
    assert.ok(kits.some((k) => k.padCount === 4));
    const layouts = kits.map((k) => `${k.padCount}:${k.notes.join(",")}`);
    assert.equal(new Set(layouts).size, kits.length, "factory kits should not share the same layout");
    const rhythms = parseDrumPresetCatalog(
      JSON.parse(readFileSync(catalogPath, "utf8").replace(/^\uFEFF/, "")),
      "native",
    );
    const kitIds = new Set(kits.map((k) => k.id));
    assert.ok(
      rhythms.every((p) => kitIds.has(p.kitId)),
      "every factory rhythm kitId must exist in the kit gallery",
    );
  });
});
