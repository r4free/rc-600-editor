import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKitRepository } from "./kitRepository.js";
import { createUserKitStore } from "./userKitStore.js";
import type { NativeKitApi } from "./nativeKitApi.js";
import type { DrumKit } from "./drumKit.js";

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

describe("userKitStore", () => {
  it("persists user kits in the given Storage", () => {
    const store = createUserKitStore(memoryStorage());
    const saved = store.upsert({
      id: "user-cajon",
      name: "Cajon",
      source: "user",
      updatedAt: "2026-01-01T00:00:00.000Z",
      padCount: 8,
      notes: [36, 38, 37, 42, 44, 39, 54, 56],
    });
    assert.equal(saved.source, "user");
    assert.equal(store.list()[0]?.padCount, 8);
    store.remove("user-cajon");
    assert.equal(store.list().length, 0);
  });
});

describe("kitRepository", () => {
  it("saves to localStorage in production and still lists factory kits", async () => {
    const api: NativeKitApi = {
      async list() {
        return [
          {
            id: "studio-16",
            name: "Studio",
            source: "native",
            updatedAt: "2026-01-01T00:00:00.000Z",
            padCount: 16,
            notes: Array.from({ length: 16 }, (_, i) => 36 + i),
          } satisfies DrumKit,
        ];
      },
      async upsert() {
        throw new Error("production must not write factory files");
      },
      async remove() {
        throw new Error("production must not delete factory files");
      },
    };
    const repo = createKitRepository({
      mode: "production",
      native: api,
      user: createUserKitStore(memoryStorage()),
    });
    assert.equal(repo.saveTarget(), "user");
    const saved = await repo.save({ name: "My kit", padCount: 4, notes: [36, 38, 42, 46] });
    assert.equal(saved.source, "user");
    assert.equal(saved.padCount, 4);
    const listed = await repo.list();
    assert.equal(listed.native[0]?.name, "Studio");
    assert.equal(listed.user[0]?.name, "My kit");
  });
});
