import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyDrumPresetPayload } from "./drumPreset.js";
import { createPresetRepository } from "./presetRepository.js";
import { createUserPresetStore } from "./userPresetStore.js";
import type { NativePresetApi } from "./nativePresetApi.js";
import type { DrumPreset } from "./drumPreset.js";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("userPresetStore", () => {
  it("persists user rhythms in the given Storage", () => {
    const store = createUserPresetStore(memoryStorage());
    const saved = store.upsert({
      id: "user-rock",
      name: "Rock",
      category: "Rock",
      kitId: "studio-16",
      source: "user",
      updatedAt: "2026-01-01T00:00:00.000Z",
      payload: { ...emptyDrumPresetPayload(), bpm: 100 },
    });
    assert.equal(saved.source, "user");
    assert.equal(store.list()[0]?.payload.bpm, 100);
    store.remove("user-rock");
    assert.equal(store.list().length, 0);
  });
});

describe("presetRepository", () => {
  it("saves to the native file API in development", async () => {
    const native: DrumPreset[] = [];
    const api: NativePresetApi = {
      async list() {
        return native;
      },
      async upsert(preset) {
        native.splice(0, native.length, { ...preset, source: "native" });
        return native[0]!;
      },
      async remove(id) {
        const i = native.findIndex((p) => p.id === id);
        if (i >= 0) native.splice(i, 1);
      },
    };
    const repo = createPresetRepository({
      mode: "development",
      native: api,
      user: createUserPresetStore(memoryStorage()),
    });
    assert.equal(repo.saveTarget(), "native");
    const saved = await repo.save({ name: "Rock", payload: emptyDrumPresetPayload() });
    assert.equal(saved.source, "native");
    assert.equal((await repo.list()).native.length, 1);
    assert.equal((await repo.list()).user.length, 0);
  });

  it("saves to localStorage in production and still lists factory rhythms", async () => {
    const api: NativePresetApi = {
      async list() {
        return [
          {
            id: "kit",
            name: "Default Kit",
            category: "Practice",
            kitId: "studio-16",
            source: "native",
            updatedAt: "2026-01-01T00:00:00.000Z",
            payload: emptyDrumPresetPayload(),
          },
        ];
      },
      async upsert() {
        throw new Error("production must not write factory files");
      },
      async remove() {
        throw new Error("production must not delete factory files");
      },
    };
    const repo = createPresetRepository({
      mode: "production",
      native: api,
      user: createUserPresetStore(memoryStorage()),
    });
    assert.equal(repo.saveTarget(), "user");
    const saved = await repo.save({ name: "My Groove", payload: emptyDrumPresetPayload() });
    assert.equal(saved.source, "user");
    const listed = await repo.list();
    assert.equal(listed.native[0]?.name, "Default Kit");
    assert.equal(listed.user[0]?.name, "My Groove");
    await repo.remove(saved.id, "user");
    assert.equal((await repo.list()).user.length, 0);
  });
});
