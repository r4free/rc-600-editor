import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendSlotDraft,
  clearSlotDraft,
  dirtySlotNumbers,
  type DraftMap,
} from "./memoryDrafts";
import type { PatchOp } from "@rc600/rc0/ops";

const op = (track: number, d: string): PatchOp => ({
  type: "track",
  track,
  tags: { D: d },
});

describe("memoryDrafts", () => {
  it("parks drafts per slot and clears one without touching others", () => {
    let drafts: DraftMap = new Map();
    drafts = appendSlotDraft(drafts, 1, [op(1, "110")]);
    drafts = appendSlotDraft(drafts, 2, [op(3, "90")]);
    drafts = appendSlotDraft(drafts, 1, [op(2, "120")]);
    assert.deepEqual(
      drafts.get(1),
      [op(1, "110"), op(2, "120")],
    );
    assert.equal(drafts.get(2)?.length, 1);
    drafts = clearSlotDraft(drafts, 1);
    assert.equal(drafts.has(1), false);
    const slot2 = drafts.get(2)?.[0];
    assert.ok(slot2 && slot2.type === "track");
    assert.equal(slot2.tags.D, "90");
    assert.deepEqual(dirtySlotNumbers(drafts), [2]);
  });

  it("discard all is an empty map", () => {
    let drafts: DraftMap = appendSlotDraft(new Map(), 5, [op(1, "1")]);
    drafts = new Map();
    assert.deepEqual(dirtySlotNumbers(drafts), []);
  });
});
