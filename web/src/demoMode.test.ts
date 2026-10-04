import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { demoSetlist, isDemoPage, isDemoPath } from "./demoMode";

describe("demo page", () => {
  it("recognizes the demo path but keeps the page closed", () => {
    assert.equal(isDemoPath("/demo"), true);
    assert.equal(isDemoPath("/demo/"), true);
    assert.equal(isDemoPath("/"), false);
    assert.equal(isDemoPath("/demo/extra"), false);
    assert.equal(isDemoPage("/demo"), false);
    assert.equal(isDemoPage("/"), false);
  });

  it("builds a sample setlist that is not empty", () => {
    const setlist = demoSetlist();
    assert.equal(setlist.songs.length, 2);
    assert.equal(setlist.songs[0]?.memorySlot, 1);
    assert.equal(setlist.songs[0]?.music?.kind, "scroll");
  });
});
