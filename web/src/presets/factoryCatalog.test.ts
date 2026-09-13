import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseDrumPresetCatalog } from "./drumPreset.js";

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
  });
});
