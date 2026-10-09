import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PartEvents } from "./exportPack.js";
import {
  barThumbnail,
  clearStep,
  duplicateBar,
  emptyPart,
  insertEmptyBar,
  laneCells,
  moveBar,
  nextVelocity,
  partLanes,
  removeBar,
  replaceBar,
  setStep,
  setStepVelocity,
  splitBars,
} from "./partEdit.js";

const BAR = 1920;

function part(notes: [number, number, number?][], bars = 2): PartEvents {
  return {
    role: "varA",
    notes: notes.map(([tick, note, velocity = 100]) => ({ tick, note, velocity, duration: 60 })),
    lengthTicks: BAR * bars,
    tempoBpm: 120,
    numerator: 4,
    denominator: 4,
    bars,
  };
}

describe("partEdit", () => {
  it("lists core lanes plus used notes in staff order", () => {
    const lanes = partLanes(part([[0, 56]]), [70]);
    assert.equal(lanes[0], 49);
    assert.equal(lanes.indexOf(36) > lanes.indexOf(38), true);
    assert.ok(lanes.includes(56) && lanes.includes(70));
    assert.ok(lanes.indexOf(56) > lanes.indexOf(36));
  });

  it("reads, sets, clears and re-voices steps", () => {
    let p = part([[0, 36], [130, 36, 50]]);
    assert.deepEqual(laneCells(p, 36, 120).slice(0, 3), [100, 50, 0]);
    p = setStep(p, 38, 4, 120, 127);
    assert.deepEqual(p.notes.find((n) => n.note === 38), { tick: 480, note: 38, velocity: 127, duration: 60 });
    p = setStepVelocity(p, 36, 1, 120, 40);
    assert.equal(p.notes.find((n) => n.tick === 130)!.velocity, 40);
    p = clearStep(p, 36, 1, 120);
    assert.equal(p.notes.some((n) => n.tick === 130), false);
    assert.equal(setStep(p, 36, 999, 120, 100), p);
  });

  it("cycles velocity levels", () => {
    assert.equal(nextVelocity(40), 96);
    assert.equal(nextVelocity(100), 127);
    assert.equal(nextVelocity(127), 40);
  });

  it("splits and edits bars", () => {
    const p = part([[0, 36], [BAR, 38], [BAR + 10, 42]]);
    assert.deepEqual(splitBars(p).map((b) => b.length), [1, 2]);

    const dup = duplicateBar(p, 0);
    assert.equal(dup.bars, 3);
    assert.equal(dup.lengthTicks, BAR * 3);
    assert.deepEqual(dup.notes.map((n) => [n.tick, n.note]), [[0, 36], [BAR, 36], [BAR * 2, 38], [BAR * 2 + 10, 42]]);

    const moved = moveBar(p, 1, 0);
    assert.deepEqual(moved.notes.map((n) => [n.tick, n.note]), [[0, 38], [10, 42], [BAR, 36]]);

    const removed = removeBar(p, 0);
    assert.equal(removed.bars, 1);
    assert.deepEqual(removed.notes.map((n) => n.tick), [0, 10]);
    assert.equal(removeBar(removed, 0), removed);

    const inserted = insertEmptyBar(p, 1);
    assert.equal(inserted.bars, 3);
    assert.deepEqual(inserted.notes.map((n) => n.tick), [0, BAR * 2, BAR * 2 + 10]);

    const cleared = replaceBar(p, 1, null);
    assert.deepEqual(cleared.notes.map((n) => n.note), [36]);
    const pasted = replaceBar(p, 1, splitBars(p)[0]!);
    assert.deepEqual(pasted.notes.map((n) => [n.tick, n.note]), [[0, 36], [BAR, 36]]);
  });

  it("builds an empty part from a meter", () => {
    const p = emptyPart("fillA", { bars: 1, numerator: 6, denominator: 8, tempoBpm: 90 });
    assert.equal(p.lengthTicks, 1440);
    assert.equal(p.notes.length, 0);
  });

  it("draws a bar thumbnail by drum family", () => {
    const t = barThumbnail([{ tick: 0, note: 36 }, { tick: 480, note: 38 }, { tick: 120, note: 42 }], BAR);
    assert.equal(t.kick[0], true);
    assert.equal(t.snare[4], true);
    assert.equal(t.hat[1], true);
    assert.equal(t.cymbal.some(Boolean), false);
  });
});
