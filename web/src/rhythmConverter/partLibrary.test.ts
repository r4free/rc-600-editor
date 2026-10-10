import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PartEvents } from "./exportPack.js";
import {
  eventsFromLibraryPart,
  libraryPartFromEvents,
  hasAllTags,
  libraryTags,
  parseLibraryPart,
  parsePartLibrary,
  partKindForRole,
  partLibraryToJson,
  rolesForKind,
  upsertPart,
} from "./partLibrary.js";
import { buildUserPattern } from "../../../server/rhythm/rc0.js";
import { lastBarOnly } from "./rhythmRc0.js";

const VAR_A: PartEvents = {
  role: "varA",
  notes: [
    { tick: 0, note: 36, velocity: 100, duration: 60 },
    { tick: 480, note: 38, velocity: 90, duration: 60 },
  ],
  lengthTicks: 1920,
  tempoBpm: 96,
  numerator: 4,
  denominator: 4,
  bars: 1,
};

const FILL_2: PartEvents = {
  role: "fillA",
  notes: [
    { tick: 0, note: 36, velocity: 100, duration: 60 },
    { tick: 1920 + 960, note: 49, velocity: 120, duration: 60 },
  ],
  lengthTicks: 3840,
  tempoBpm: 96,
  numerator: 4,
  denominator: 4,
  bars: 2,
};

describe("partLibrary", () => {
  it("maps roles to kinds and back", () => {
    assert.equal(partKindForRole("varC"), "variation");
    assert.equal(partKindForRole("fillB"), "fill");
    assert.deepEqual(rolesForKind("fill"), ["fillA", "fillB", "fillC", "fillD"]);
    assert.deepEqual(rolesForKind("intro"), ["intro"]);
  });

  it("round-trips a part through JSON and back into any role", () => {
    const part = libraryPartFromEvents(VAR_A, { name: "  Funk   Groove ", tags: ["Funk", " funk ", "Groove"], source: "user" });
    assert.equal(part.name, "Funk Groove");
    assert.equal(part.kind, "variation");
    assert.match(part.id, /^user-funk-groove-/);
    assert.deepEqual(part.tags, ["Funk", "Groove"]);
    const [back] = parsePartLibrary(JSON.parse(partLibraryToJson([part])), "user");
    assert.deepEqual(back, part);
    const ev = eventsFromLibraryPart(back!, "varC");
    assert.equal(ev.role, "varC");
    assert.deepEqual(ev.notes.map((n) => n.tick), [0, 480]);
  });

  it("cleans bad input", () => {
    assert.equal(parseLibraryPart({ kind: "variation", name: "x", lengthTicks: 0, notes: [] }, "user"), null);
    const p = parseLibraryPart(
      {
        kind: "fill",
        name: "",
        lengthTicks: 960,
        notes: [{ tick: 5000, note: 36 }, { tick: 10, note: 200 }, { tick: 20, note: 38, velocity: 999 }],
      },
      "native",
    )!;
    assert.equal(p.name, "Untitled part");
    assert.deepEqual(p.notes, [{ tick: 20, note: 38, velocity: 127 }]);
    const legacy = parseLibraryPart({ kind: "fill", name: "Old", style: "Rock", lengthTicks: 960, notes: [] }, "user")!;
    assert.deepEqual(legacy.tags, ["Rock"]);
  });

  it("upserts by name within a kind and lists styles", () => {
    const a = libraryPartFromEvents(VAR_A, { name: "Groove", tags: ["Rock"], source: "user", id: "a" });
    const fill = libraryPartFromEvents(FILL_2, { name: "Groove", tags: ["Pop", "Rock"], source: "user", id: "f" });
    let list = upsertPart([], a);
    list = upsertPart(list, fill);
    list = upsertPart(list, { ...a, id: "new", tempoBpm: 140 });
    assert.deepEqual(list.map((p) => [p.id, p.kind]), [["a", "variation"], ["f", "fill"]]);
    assert.equal(list.find((p) => p.id === "a")!.tempoBpm, 140);
    assert.deepEqual(libraryTags(list), ["Pop", "Rock"]);
    assert.equal(hasAllTags(list[1]!, ["rock", "POP"]), true);
    assert.equal(hasAllTags(list[0]!, ["Pop"]), false);
  });

  it("builds an RC-600 rhythm from library parts only, trimming long fills", () => {
    const trimmed = lastBarOnly(FILL_2);
    assert.equal(trimmed.bars, 1);
    assert.deepEqual(trimmed.notes.map((n) => [n.tick, n.note]), [[960, 49]]);
    const parts = [
      eventsFromLibraryPart(libraryPartFromEvents(VAR_A, { name: "A", tags: [], source: "user" }), "varB"),
      eventsFromLibraryPart(libraryPartFromEvents(FILL_2, { name: "F", tags: [], source: "user" }), "fillB"),
    ];
    const p = buildUserPattern(parts, { name: "Lib", kit: 0 });
    assert.equal(p.tempo, 96);
    assert.equal(p.totalBars, 2);
    assert.deepEqual(p.phrases[3], { from: 0, bars: 1 }, "Var B");
    assert.deepEqual(p.phrases[4], { from: 1, bars: 1 }, "Fill B");
    assert.deepEqual(p.phrases[1], { from: 0, bars: 1 }, "Var A falls back to the first variation");
  });
});
