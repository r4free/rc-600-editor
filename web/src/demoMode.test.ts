import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { demoSetlist, isDemoPage } from "./demoMode.ts";

describe("demo page", () => {
  it("matches only the public demo path", () => {
    assert.equal(isDemoPage("/demo"), true);
    assert.equal(isDemoPage("/demo/"), true);
    assert.equal(isDemoPage("/"), false);
    assert.equal(isDemoPage("/demo/extra"), false);
  });

  it("builds a sample setlist that is not empty", () => {
    const setlist = demoSetlist();
    assert.equal(setlist.songs.length, 2);
    assert.equal(setlist.songs[0]?.memorySlot, 1);
    assert.equal(setlist.songs[0]?.music?.kind, "scroll");
  });
});
