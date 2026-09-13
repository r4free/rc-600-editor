import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { emptyDrumPresetPayload } from "../web/src/presets/drumPreset.js";
import { createNativePresetFileStore, isNativePresetWriteAllowed } from "./drum-presets.js";

describe("native preset file store", () => {
  it("allows writes outside production NODE_ENV", () => {
    assert.equal(isNativePresetWriteAllowed("development"), true);
    assert.equal(isNativePresetWriteAllowed(undefined), true);
    assert.equal(isNativePresetWriteAllowed("production"), false);
  });

  it("upserts and deletes JSON on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rc600-presets-"));
    const file = join(dir, "presets.json");
    const store = createNativePresetFileStore(file);
    const saved = await store.upsert({
      id: "rock",
      name: "Rock",
      payload: { ...emptyDrumPresetPayload(), bpm: 118 },
    });
    assert.equal(saved.id, "rock");
    const disk = JSON.parse(await readFile(file, "utf8")) as { presets: { payload: { bpm: number } }[] };
    assert.equal(disk.presets[0]?.payload.bpm, 118);
    assert.equal(await store.remove("rock"), true);
    assert.equal((await store.list()).length, 0);
  });
});
