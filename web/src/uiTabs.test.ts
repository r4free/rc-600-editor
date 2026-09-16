import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UI_TABS_KEY, loadUiTabs, readUiTab, saveUiTab, subscribeUiTabs } from "./uiTabs";

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

describe("ui tabs prefs", () => {
  it("persists selected tabs and ignores unknown values", () => {
    withLocalStorage(() => {
      assert.deepEqual(loadUiTabs(), {});
      saveUiTab("workspace", "system");
      saveUiTab("memory", "mixer");
      saveUiTab("loopTrack", 4);
      assert.equal(
        readUiTab("workspace", "memory", ["memory", "system", "play-drum", "setlists", "tuner"]),
        "system",
      );
      assert.equal(readUiTab("memory", "loop", ["info", "loop", "mixer"]), "mixer");
      assert.equal(readUiTab("loopTrack", 1, [1, 2, 3, 4, 5, 6]), 4);
      assert.equal(readUiTab("memory", "loop", ["info", "loop"]), "loop");
      assert.ok(globalThis.localStorage.getItem(UI_TABS_KEY)?.includes("system"));
    });
  });

  it("returns defaults when storage is missing or corrupt", () => {
    withLocalStorage(() => {
      globalThis.localStorage.setItem(UI_TABS_KEY, "{not json");
      assert.equal(readUiTab("workspace", "memory", ["memory", "system"]), "memory");
    });
  });

  it("broadcasts saves to subscribers", () => {
    withLocalStorage(() => {
      const seen: { key: string; value: string | number }[] = [];
      const unsub = subscribeUiTabs((key, value) => {
        seen.push({ key, value });
      });
      saveUiTab("loop", "rhythm");
      saveUiTab("loopTrack", 3);
      assert.deepEqual(seen, [
        { key: "loop", value: "rhythm" },
        { key: "loopTrack", value: 3 },
      ]);
      unsub();
      saveUiTab("loop", "track");
      assert.equal(seen.length, 2);
    });
  });
});
