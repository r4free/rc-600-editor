import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainFocusFor } from "./chainFocus.js";

describe("chainFocusFor", () => {
  it("jumps input / ifx / track / rhythm / mix / dest / mfx", () => {
    assert.deepEqual(chainFocusFor("input:mic1"), {
      tab: "input",
      prefs: { "input.mem": "setup" },
    });
    assert.deepEqual(chainFocusFor("ifx:2:1"), {
      tab: "ifx",
      prefs: { ifx: "C", ifxSlot: 1 },
    });
    assert.deepEqual(chainFocusFor("track:4"), {
      tab: "loop",
      prefs: { loop: "track", loopTrack: 4 },
    });
    assert.deepEqual(chainFocusFor("rhythm"), {
      tab: "loop",
      prefs: { loop: "rhythm" },
    });
    assert.deepEqual(chainFocusFor("tfx:0:2"), {
      tab: "tfx",
      prefs: { tfx: "A", tfxSlot: 2 },
    });
    assert.deepEqual(chainFocusFor("mix"), {
      tab: "mixer",
      prefs: { "mixer.mem": "output" },
    });
    assert.deepEqual(chainFocusFor("dest:main-l"), {
      tab: "output",
      prefs: { "output.mem": "routing" },
    });
    assert.deepEqual(chainFocusFor("mfx"), {
      tab: "output",
      prefs: { "output.mem": "mfx" },
    });
  });
});
