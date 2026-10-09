import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createNativePartFileStore } from "./rhythm-parts.js";

const PART = {
  id: "rock-verse-a",
  name: "Rock Verse A",
  kind: "variation",
  tags: ["Rock"],
  tempoBpm: 120,
  numerator: 4,
  denominator: 4,
  bars: 1,
  lengthTicks: 1920,
  notes: [
    { tick: 0, note: 36, velocity: 100 },
    { tick: 480, note: 38, velocity: 90 },
  ],
};

describe("native rhythm part file store", () => {
  it("upserts, overwrites by name and deletes JSON on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rc600-parts-"));
    const file = join(dir, "parts.json");
    const store = createNativePartFileStore(file);
    const saved = await store.upsert(PART);
    assert.equal(saved.id, "rock-verse-a");
    assert.equal(saved.source, "native");

    await store.upsert({ ...PART, id: "other", name: "rock verse a", tempoBpm: 100 });
    const list = await store.list();
    assert.equal(list.length, 1, "same name + kind replaces");
    assert.equal(list[0]!.id, "rock-verse-a");
    assert.equal(list[0]!.tempoBpm, 100);

    const disk = JSON.parse(await readFile(file, "utf8")) as { version: number; parts: { source?: string }[] };
    assert.equal(disk.version, 1);
    assert.equal(disk.parts[0]!.source, undefined, "source is not stored");

    assert.equal(await store.remove("rock-verse-a"), true);
    assert.equal(await store.remove("missing"), false);
    assert.equal((await store.list()).length, 0);
  });

  it("rejects invalid parts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rc600-parts-"));
    const store = createNativePartFileStore(join(dir, "parts.json"));
    await assert.rejects(store.upsert({ ...PART, kind: "solo" }), /Invalid rhythm part/);
  });
});
