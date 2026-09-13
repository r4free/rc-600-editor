import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogToJson,
  emptyDrumPresetPayload,
  newPresetId,
  parseDrumPresetCatalog,
  parseDrumPresetPayload,
  resolvePresetSaveTarget,
  slugifyPresetName,
  upsertPreset,
  withMixedPadVelocities,
} from "./drumPreset.js";

describe("drumPreset", () => {
  it("clamps notes, BPM, velocity, and pad hits", () => {
    const payload = parseDrumPresetPayload({
      notes: [200, -1],
      bpm: 9,
      meter: "7/8",
      velocity: 400,
      overrides: { "0": { hitsPerBar: 99, velocity: 200 }, "99": { hitsPerBar: 4 } },
    });
    assert.equal(payload.notes.length, 2);
    assert.equal(payload.notes[0], 127);
    assert.equal(payload.notes[1], 0);
    assert.equal(payload.bpm, 20);
    assert.equal(payload.meter, "4/4");
    assert.equal(payload.velocity, 127);
    assert.equal(payload.overrides["0"]?.hitsPerBar, 16);
    assert.equal(payload.overrides["0"]?.velocity, 127);
    assert.equal(payload.overrides["99"], undefined);
  });

  it("bakes a kick-forward hat-back mix onto every pad", () => {
    const mixed = withMixedPadVelocities({
      ...emptyDrumPresetPayload(),
      velocity: 100,
      overrides: { "0": { hitsPerBar: 4 }, "4": { hitsPerBar: 16 } },
    });
    assert.equal(mixed.overrides["0"]?.hitsPerBar, 4);
    assert.equal(mixed.overrides["0"]?.velocity, 114);
    assert.ok((mixed.overrides["4"]?.velocity ?? 0) < (mixed.overrides["0"]?.velocity ?? 0));
    assert.equal(mixed.overrides["1"]?.hitsPerBar ?? 0, 0);
    assert.ok((mixed.overrides["1"]?.velocity ?? 0) >= 1);
  });

  it("falls back to an empty kit when JSON is junk", () => {
    const payload = parseDrumPresetPayload(null);
    assert.equal(payload.notes.length, 16);
    assert.equal(payload.bpm, 120);
    assert.deepEqual(payload.overrides, {});
  });

  it("parses a catalog, drops duplicates, and tags the source", () => {
    const list = parseDrumPresetCatalog(
      {
        version: 1,
        presets: [
          {
            id: "rock",
            name: " Rock ",
            updatedAt: "2026-01-01T00:00:00.000Z",
            payload: emptyDrumPresetPayload(),
          },
          { id: "rock", name: "Dup", payload: emptyDrumPresetPayload() },
          { name: "missing-id", payload: emptyDrumPresetPayload() },
        ],
      },
      "native",
    );
    assert.equal(list.length, 1);
    assert.equal(list[0]?.source, "native");
    assert.equal(list[0]?.name, "Rock");
    assert.equal(list[0]?.category, "Rock");
    assert.equal(list[0]?.kitId, "studio-16");
  });

  it("upserts by id or matching name", () => {
    const a = {
      id: "a",
      name: "Rock",
      category: "Rock" as const,
      kitId: "studio-16",
      source: "user" as const,
      updatedAt: "2026-01-01T00:00:00.000Z",
      payload: emptyDrumPresetPayload(),
    };
    const renamed = { ...a, payload: { ...a.payload, bpm: 90 } };
    const list = upsertPreset([a], renamed);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.payload.bpm, 90);
    const extra = upsertPreset(list, { ...a, id: "b", name: "Funk" });
    assert.equal(extra.length, 2);
  });

  it("round-trips catalog JSON and maps save target from NODE_ENV / Vite MODE", () => {
    const json = catalogToJson([
      {
        id: "kit",
        name: "Default Kit",
        category: "Practice",
        kitId: "studio-16",
        source: "native",
        updatedAt: "2026-01-01T00:00:00.000Z",
        payload: emptyDrumPresetPayload(),
      },
    ]);
    const parsed = parseDrumPresetCatalog(JSON.parse(json), "native");
    assert.equal(parsed[0]?.name, "Default Kit");
    assert.equal(parsed[0]?.kitId, "studio-16");
    assert.equal(resolvePresetSaveTarget("development"), "native");
    assert.equal(resolvePresetSaveTarget("production"), "user");
    assert.equal(slugifyPresetName("Four on the Floor"), "four-on-the-floor");
    assert.equal(newPresetId("native", "Rock!"), "rock");
    assert.match(newPresetId("user", "Rock"), /^user-rock-/);
  });
});
