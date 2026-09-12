import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FOLDER_META_KEY,
  clearFolderMeta,
  loadFolderMeta,
  saveFolderMeta,
} from "./folder-store.js";

function withLocalStorage<T>(fn: () => T): T {
  const store = new Map<string, string>();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    },
  });
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "localStorage");
    } else {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous });
    }
  }
}

describe("folder meta", () => {
  it("persists last folder label, slot, and backup ack", () => {
    withLocalStorage(() => {
      assert.deepEqual(loadFolderMeta(), { rootLabel: null, lastSlot: null, backupAck: false });
      saveFolderMeta({ rootLabel: "ROLAND", lastSlot: 12, backupAck: true });
      assert.deepEqual(loadFolderMeta(), { rootLabel: "ROLAND", lastSlot: 12, backupAck: true });
      saveFolderMeta({ lastSlot: 3 });
      assert.equal(loadFolderMeta().lastSlot, 3);
      assert.equal(loadFolderMeta().backupAck, true);
      clearFolderMeta();
      assert.equal(globalThis.localStorage.getItem(FOLDER_META_KEY), null);
      assert.deepEqual(loadFolderMeta(), { rootLabel: null, lastSlot: null, backupAck: false });
    });
  });

  it("ignores invalid lastSlot values", () => {
    withLocalStorage(() => {
      globalThis.localStorage.setItem(
        FOLDER_META_KEY,
        JSON.stringify({ rootLabel: "ROLAND", lastSlot: 0, backupAck: true }),
      );
      assert.equal(loadFolderMeta().lastSlot, null);
      assert.equal(loadFolderMeta().backupAck, true);
    });
  });
});
