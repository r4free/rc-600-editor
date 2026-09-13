import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createNativeKitFileStore } from "./drum-kits.js";

describe("native kit file store", () => {
  it("upserts and deletes JSON on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rc600-kits-"));
    const file = join(dir, "kits.json");
    const store = createNativeKitFileStore(file);
    const saved = await store.upsert({
      id: "practice-4",
      name: "Practice",
      notes: [36, 38, 42, 46],
    });
    assert.equal(saved.padCount, 4);
    const disk = JSON.parse(await readFile(file, "utf8")) as { kits: { padCount: number }[] };
    assert.equal(disk.kits[0]?.padCount, 4);
    assert.equal(await store.remove("practice-4"), true);
    assert.equal((await store.list()).length, 0);
  });
});
