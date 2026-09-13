import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_KIT_ID,
  factoryDrumKits,
  kitsEqualLayout,
  parseDrumKit,
  parseDrumKitCatalog,
  parseKitNotes,
  upsertKit,
} from "./drumKit.js";

describe("drumKit", () => {
  it("parses pad count from the notes list", () => {
    const kit = parseDrumKit(
      { id: "cajon-8", name: " Cajon ", notes: [36, 38, 37, 42, 44, 39, 54, 56] },
      "native",
    );
    assert.ok(kit);
    assert.equal(kit.name, "Cajon");
    assert.equal(kit.padCount, 8);
    assert.equal(kit.notes.length, 8);
    assert.equal(parseKitNotes([36], 4).length, 4);
  });

  it("drops invalid kits and duplicate ids", () => {
    const list = parseDrumKitCatalog(
      {
        version: 1,
        kits: [
          { id: "studio-16", name: "Studio", notes: [36, 38, 42, 46] },
          { id: "studio-16", name: "Dup", notes: [36] },
          { name: "missing-id", notes: [36] },
        ],
      },
      "native",
    );
    assert.equal(list.length, 1);
    assert.equal(list[0]?.padCount, 4);
  });

  it("builds distinct factory layouts and keeps Studio as default", () => {
    const kits = factoryDrumKits();
    assert.ok(kits.length >= 8);
    assert.equal(new Set(kits.map((k) => k.id)).size, kits.length);
    const studio = kits.find((k) => k.id === DEFAULT_KIT_ID);
    assert.ok(studio);
    assert.equal(studio.padCount, 16);
    const cajon = kits.find((k) => k.id === "cajon-8");
    const latin = kits.find((k) => k.id === "latin-12");
    assert.ok(cajon && latin);
    assert.notDeepEqual(cajon.notes, latin.notes);
    assert.ok(kitsEqualLayout(studio, studio.notes, 16));
    assert.equal(kitsEqualLayout(studio, studio.notes, 8), false);
  });

  it("upserts by id or matching name", () => {
    const a = {
      id: "a",
      name: "Rock",
      source: "user" as const,
      updatedAt: "2026-01-01T00:00:00.000Z",
      padCount: 8,
      notes: [36, 38, 42, 46, 41, 43, 49, 51],
    };
    const list = upsertKit([a], { ...a, padCount: 4, notes: [36, 38, 42, 46] });
    assert.equal(list.length, 1);
    assert.equal(list[0]?.padCount, 4);
  });
});
