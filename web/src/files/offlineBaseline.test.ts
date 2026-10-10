import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listMemorySlots, slotFileName, systemFileName } from "@rc600/files/roland";
import {
  buildOfflineBaseline,
  fillMissingSlots,
  normalizeMemoryIds,
  withPathMemoryId,
} from "./offlineBaseline";

const templates = { memory: '<mem id="0">init</mem>', system: "<sys>init</sys>" };

describe("offlineBaseline", () => {
  it("builds all 99 memories plus system", () => {
    const files = buildOfflineBaseline(templates);
    const slots = listMemorySlots(files);
    assert.equal(slots.length, 99);
    assert.equal(slots[0], 1);
    assert.equal(slots[98], 99);
    assert.equal(files.get(systemFileName("1")), templates.system);
  });

  it("fills only missing slots", () => {
    const loaded = new Map([
      [slotFileName(1, "A"), '<mem id="0">mine</mem>'],
      [slotFileName(2, "B"), '<mem id="1">mine b</mem>'],
      [systemFileName("2"), "<sys>mine</sys>"],
    ]);
    const { files, added } = fillMissingSlots(loaded, templates);
    assert.equal(added.length, 97);
    assert.equal(added.includes(1) || added.includes(2), false);
    assert.equal(files.get(slotFileName(1, "A")), '<mem id="0">mine</mem>');
    assert.equal(files.has(slotFileName(2, "A")), false);
    assert.equal(files.has(systemFileName("1")), false);
    assert.equal(listMemorySlots(files).length, 99);
  });

  it("writes the right <mem id> for each slot", () => {
    assert.equal(withPathMemoryId(slotFileName(42, "B"), templates.memory), '<mem id="41">init</mem>');
    assert.equal(withPathMemoryId(systemFileName("1"), templates.system), templates.system);
    const out = normalizeMemoryIds(buildOfflineBaseline(templates));
    assert.equal(out.get(slotFileName(99, "A")), '<mem id="98">init</mem>');
  });
});
