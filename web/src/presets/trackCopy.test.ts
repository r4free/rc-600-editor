import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRACK_PARAMS } from "@rc600/catalog/params";
import { expandMemoryRanges, trackCopyTags } from "./trackCopy";

describe("trackCopyTags", () => {
  it("copies TRACK_PARAMS tags and Q, excludes V/X", () => {
    const tags = trackCopyTags({
      A: "1",
      D: "120",
      Q: "127",
      V: "1",
      X: "2",
      Z: "9",
    });
    assert.equal(tags.A, "1");
    assert.equal(tags.D, "120");
    assert.equal(tags.Q, "127");
    assert.equal(tags.V, undefined);
    assert.equal(tags.X, undefined);
    assert.equal(tags.Z, undefined);
    for (const def of TRACK_PARAMS) {
      assert.ok(!(def.tag in tags) || tags[def.tag] !== undefined);
    }
  });

  it("omits missing tags", () => {
    assert.deepEqual(trackCopyTags({ D: "100" }), { D: "100" });
  });
});

describe("expandMemoryRanges", () => {
  it("merges two ranges uniquely and sorts", () => {
    assert.deepEqual(
      expandMemoryRanges([
        { from: 5, to: 7 },
        { from: 6, to: 8 },
      ]),
      [5, 6, 7, 8],
    );
  });

  it("skips invalid or empty ranges", () => {
    assert.deepEqual(
      expandMemoryRanges([
        { from: 10, to: 8 },
        null,
        undefined,
        { from: 0, to: 2 },
        { from: 98, to: 100 },
        { from: 1, to: 2 },
      ]),
      [1, 2],
    );
  });

  it("clamps only when both ends are in 1–99", () => {
    assert.deepEqual(expandMemoryRanges([{ from: 99, to: 99 }]), [99]);
    assert.deepEqual(expandMemoryRanges([{ from: 1.9, to: 3.2 }]), [1, 2, 3]);
  });
});
