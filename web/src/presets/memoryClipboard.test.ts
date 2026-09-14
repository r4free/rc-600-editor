import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyMemoryCopySelection,
  memoryCopySelectionHasContent,
  parseMemoryCopySelection,
  selectAllMemoryCopySelection,
  summarizeMemoryCopySelection,
  wavTracksForSelection,
} from "@rc600/rc0/memoryCopy";
import {
  MEMORY_CLIPBOARD_KEY,
  clearMemoryClipboard,
  loadMemoryClipboard,
  loadSkipApplyConfirm,
  saveMemoryClipboard,
  saveSkipApplyConfirm,
} from "./memoryClipboard";

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
    if (previous === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous });
  }
}

describe("memoryCopy selection", () => {
  it("detects content and wav tracks", () => {
    const empty = emptyMemoryCopySelection();
    assert.equal(memoryCopySelectionHasContent(empty), false);
    empty.assigns = [1];
    assert.equal(memoryCopySelectionHasContent(empty), true);
    empty.includeWav = true;
    empty.tracks = [2, 4];
    assert.deepEqual(wavTracksForSelection(empty), [2, 4]);
    const all = selectAllMemoryCopySelection();
    assert.equal(all.copyAll, true);
    assert.deepEqual(wavTracksForSelection(all), [1, 2, 3, 4, 5, 6]);
    assert.ok(summarizeMemoryCopySelection(all).includes("Entire"));
  });

  it("parses selection JSON", () => {
    const sel = parseMemoryCopySelection({
      assigns: [1, 2, 99],
      ifxBanks: [true, false, false, false],
    });
    assert.ok(sel);
    assert.deepEqual(sel!.assigns, [1, 2]);
    assert.deepEqual(sel!.ifxBanks, [true, false, false, false]);
  });
});

describe("memoryClipboard storage", () => {
  it("round-trips clipboard and skip-confirm pref", () => {
    withLocalStorage(() => {
      assert.equal(loadMemoryClipboard(), null);
      const sel = emptyMemoryCopySelection();
      sel.rec = true;
      saveMemoryClipboard({
        sourceSlot: 1,
        sourceName: "Rock",
        sourceXml: "<xml/>",
        selection: sel,
      });
      const loaded = loadMemoryClipboard();
      assert.equal(loaded?.sourceSlot, 1);
      assert.equal(loaded?.selection.rec, true);
      assert.ok(globalThis.localStorage.getItem(MEMORY_CLIPBOARD_KEY));
      clearMemoryClipboard();
      assert.equal(loadMemoryClipboard(), null);

      assert.equal(loadSkipApplyConfirm(), false);
      saveSkipApplyConfirm(true);
      assert.equal(loadSkipApplyConfirm(), true);
    });
  });
});
