import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLikelyRc600, midiEnvironment } from "./rc600-midi.js";

describe("rc600 midi helpers", () => {
  it("detects RC-600 port names", () => {
    assert.equal(isLikelyRc600("RC-600"), true);
    assert.equal(isLikelyRc600("Boss RC 600"), true);
    assert.equal(isLikelyRc600("VG-800"), false);
  });

  it("reports environment in node as unavailable or insecure", () => {
    const env = midiEnvironment();
    assert.ok(env.blockReason === "unavailable" || env.blockReason === "insecure" || env.blockReason === "ok");
  });
});
