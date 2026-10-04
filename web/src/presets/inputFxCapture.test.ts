import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseMemory } from "@rc600/rc0/memory";
import { capturedPresetName, captureInputFxPresets, inputFxPresetKey } from "./inputFxCapture.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fix = (name: string) => readFileSync(join(root, "fixtures", "DATA", name), "utf8");

describe("inputFxCapture", () => {
  it("names captured effects after memory and FX slot, within 40 characters", () => {
    assert.equal(capturedPresetName(7, "Funk Jam", 0, 1), "007 Funk Jam AB");
    assert.equal(capturedPresetName(12, "   ", 3, 3), "012 DD");
    const long = capturedPresetName(99, "x".repeat(60), 2, 0);
    assert.ok(long.length <= 40);
    assert.ok(long.startsWith("099 x") && long.endsWith(" CA"));
  });

  it("captures every non-THRU input FX slot with its block settings", () => {
    const xml = fix("MEMORY001A.RC0");
    const model = parseMemory(xml, 1);
    const { presets, added, duplicates, memories } = captureInputFxPresets([{ slot: 1, xml }], []);
    assert.equal(memories, 1);
    assert.equal(added + duplicates, countConfigured(model.ifxSlots));
    assert.equal(presets.length, added);
    const first = presets.find((p) => p.name.endsWith(" AA"));
    assert.ok(first);
    assert.equal(first.type, 23);
    assert.equal(first.source, "user");
    assert.ok(Object.keys(first.tags).length > 0);
  });

  it("skips effects that are already in the library", () => {
    const xml = fix("MEMORY001A.RC0");
    const once = captureInputFxPresets([{ slot: 1, xml }], []);
    const again = captureInputFxPresets([{ slot: 1, xml }, { slot: 2, xml }], once.presets);
    assert.equal(again.added, 0);
    assert.equal(again.presets.length, once.presets.length);
    const keys = new Set(again.presets.map(inputFxPresetKey));
    assert.equal(keys.size, again.presets.length);
  });
});

function countConfigured(slots: Record<string, string | undefined>[][]): number {
  let n = 0;
  for (const row of slots) for (const s of row) if (parseInt(s.C ?? "0", 10) > 0) n++;
  return n;
}
