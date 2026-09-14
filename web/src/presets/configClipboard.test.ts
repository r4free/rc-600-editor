import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONFIG_CLIPBOARD_KEY,
  CONFIG_CLIPBOARD_SLOTS,
  clearClipboardSlot,
  loadClipboard,
  parseClipboard,
  pickTags,
  readClipboardSlot,
  saveClipboardSlot,
} from "./configClipboard";

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

describe("configClipboard", () => {
  it("starts with five empty slots", () => {
    const store = memoryStorage();
    const slots = loadClipboard(store);
    assert.equal(slots.length, CONFIG_CLIPBOARD_SLOTS);
    assert.ok(slots.every((s) => s === null));
  });

  it("saves, reads, and clears a slot", () => {
    const store = memoryStorage();
    saveClipboardSlot(
      0,
      { kind: "track", label: "Track 3", tags: { D: "180", Q: "127" } },
      store,
    );
    const slot = readClipboardSlot(0, store);
    assert.equal(slot?.kind, "track");
    assert.equal(slot?.label, "Track 3");
    assert.equal(slot?.tags.D, "180");
    assert.ok(slot?.updatedAt);

    clearClipboardSlot(0, store);
    assert.equal(readClipboardSlot(0, store), null);
    assert.ok(store.getItem(CONFIG_CLIPBOARD_KEY));
  });

  it("ignores junk JSON and out-of-range indexes", () => {
    const store = memoryStorage();
    store.setItem(CONFIG_CLIPBOARD_KEY, "{not json");
    assert.equal(loadClipboard(store).filter(Boolean).length, 0);

    assert.equal(readClipboardSlot(-1, store), null);
    assert.equal(readClipboardSlot(99, store), null);
    const before = loadClipboard(store);
    assert.deepEqual(saveClipboardSlot(99, { kind: "rec", label: "x", tags: {} }, store), before);
  });

  it("parses partial arrays and drops invalid entries", () => {
    const slots = parseClipboard([
      { kind: "assign", label: "Assign 1", tags: { A: "1" }, updatedAt: "2026-01-01T00:00:00.000Z" },
      { kind: "track", label: "bad", tags: { D: 1 }, updatedAt: "x" },
      null,
    ]);
    assert.equal(slots[0]?.kind, "assign");
    assert.equal(slots[1], null);
    assert.equal(slots.length, 5);
  });

  it("pickTags keeps only listed present tags", () => {
    assert.deepEqual(pickTags({ A: "1", D: "2", V: "9" }, ["A", "D", "Q"]), { A: "1", D: "2" });
  });
});
