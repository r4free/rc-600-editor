import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PartEvents } from "./exportPack.js";
import {
  encodeSlot,
  readRhythmRc0,
  recordFromData,
  slotFromRecord,
  writeRhythmRc0,
} from "../../../server/rhythm/rc0.js";
import {
  PEDAL_IMPORT_TAG,
  libraryPartsFromRhythm,
  parseRhythmLibrary,
  partsFromRhythm,
  rhythmFromParts,
  rhythmLibraryToJson,
  rhythmsFromSlots,
  upsertRhythm,
  type LibraryRhythm,
} from "./rhythmLibrary.js";
import { createRhythmLibraryRepository } from "./rhythmLibraryRepository.js";
import { mergeRecordsByName } from "./rhythmRc0.js";

const slot = (r: LibraryRhythm) => encodeSlot(partsFromRhythm(r), r.name, r.kit);

function part(role: PartEvents["role"], note = 36): PartEvents {
  return {
    role,
    notes: [
      { tick: 0, note, velocity: 100, duration: 60 },
      { tick: 960, note: 38, velocity: 90, duration: 60 },
    ],
    lengthTicks: 1920,
    tempoBpm: 100,
    numerator: 4,
    denominator: 4,
    bars: 1,
  };
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

const ROCK = rhythmFromParts([part("varA"), part("fillA", 42), part("ending", 49)], {
  name: "Rock Basic",
  kit: 3,
  tags: ["Rock"],
  source: "user",
  id: "rock",
});

describe("rhythmLibrary", () => {
  it("round-trips a rhythm through JSON with its parts and kit", () => {
    const [back] = parseRhythmLibrary(JSON.parse(rhythmLibraryToJson([ROCK])), "native");
    assert.equal(back!.name, "Rock Basic");
    assert.equal(back!.kit, 3);
    assert.deepEqual(back!.tags, ["Rock"]);
    assert.deepEqual(Object.keys(back!.parts).sort(), ["ending", "fillA", "varA"]);
    const parts = partsFromRhythm(back!);
    assert.deepEqual(
      parts.map((p) => p.role),
      ["varA", "fillA", "ending"],
    );
    assert.equal(parts[1]!.notes[0]!.note, 42);
  });

  it("drops rhythms without valid parts", () => {
    assert.deepEqual(parseRhythmLibrary({ rhythms: [{ name: "Empty", parts: {} }] }, "user"), []);
  });

  it("replaces a rhythm with the same name", () => {
    const list = upsertRhythm([ROCK], { ...ROCK, id: "other", name: "rock basic", kit: 5 });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.id, "rock");
    assert.equal(list[0]!.kit, 5);
  });

  it("writes several rhythms into one file, reusing slots with the same name", () => {
    const funk = { ...ROCK, id: "funk", name: "Funk" };
    const first = mergeRecordsByName([], [slot(ROCK), slot(funk)]);
    assert.deepEqual(first.records.map((r) => r.name), ["Rock Basic", "Funk"]);
    const again = mergeRecordsByName(first.records, [slot(funk), slot({ ...ROCK, id: "new", name: "Samba" })]);
    assert.deepEqual(again.records.map((r) => r.name), ["Rock Basic", "Funk", "Samba"]);
    assert.deepEqual(
      again.slots.map((s) => [s.index, s.replaced]),
      [
        [1, true],
        [2, false],
      ],
    );
  });

  it("reads pedal rhythms back with only their own parts", () => {
    const groove = { ...part("varA"), bars: 2, lengthTicks: 3840 };
    groove.notes = [...groove.notes, { tick: 1920, note: 42, velocity: 80, duration: 60 }];
    const slots = readRhythmRc0(
      writeRhythmRc0([
        recordFromData(
          slot(rhythmFromParts([part("intro", 49), groove, part("fillA", 45)], { name: "Pedal Rock", kit: 2, tags: [], source: "user" }))
            .data,
        ),
      ]),
    ).map(slotFromRecord);
    const [found] = rhythmsFromSlots(slots);
    assert.equal(found!.slot, 0);
    assert.equal(found!.rhythm.name, "Pedal Rock");
    assert.equal(found!.rhythm.kit, 2);
    assert.deepEqual(found!.rhythm.tags, [PEDAL_IMPORT_TAG]);
    const parts = partsFromRhythm(found!.rhythm);
    assert.deepEqual(
      parts.map((p) => [p.role, p.bars]),
      [
        ["intro", 1],
        ["varA", 2],
        ["fillA", 1],
      ],
    );
    assert.deepEqual(
      parts[1]!.notes.map((n) => [n.tick, n.note]),
      [
        [0, 36],
        [960, 38],
        [1920, 42],
      ],
    );
    const libParts = libraryPartsFromRhythm(found!.rhythm, "user");
    assert.deepEqual(
      libParts.map((p) => [p.name, p.kind]),
      [
        ["Pedal Rock Intro", "intro"],
        ["Pedal Rock Variation A", "variation"],
        ["Pedal Rock Fill A", "fill"],
      ],
    );
  });

  it("saves user rhythms in browser storage in production", async () => {
    const fetchImpl = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
    const repo = createRhythmLibraryRepository({ mode: "production", storage: memoryStorage(), fetchImpl });
    assert.equal(repo.saveTarget(), "user");
    await repo.save(ROCK);
    const { native, user } = await repo.list();
    assert.equal(native.length, 0);
    assert.equal(user[0]!.name, "Rock Basic");
    await assert.rejects(repo.save(ROCK, "native"));
  });
});
