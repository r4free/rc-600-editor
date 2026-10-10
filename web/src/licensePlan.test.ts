import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { licenseBadgeText, licenseDaysLeft, previewBlocksListSave, previewBlocksPedalSave } from "./licensePlan";

describe("preview license", () => {
  it("blocks setlists and rhythm lists only for a preview key", () => {
    assert.equal(previewBlocksListSave("preview"), true);
    assert.equal(previewBlocksListSave("full"), false);
    assert.equal(previewBlocksListSave(undefined), false);
  });

  it("blocks memory saves on a preview key only while the pedal is connected", () => {
    assert.equal(previewBlocksPedalSave("preview", true), true);
    assert.equal(previewBlocksPedalSave("preview", false), false);
    assert.equal(previewBlocksPedalSave("full", true), false);
  });

  it("counts the days left on a trial key", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    assert.equal(licenseDaysLeft(undefined, now), null);
    assert.equal(licenseDaysLeft("2026-10-17T11:00:00Z", now), 7);
    assert.equal(licenseDaysLeft("2026-10-09T00:00:00Z", now), 0);
  });

  it("labels trial and preview keys, not a permanent full key", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    assert.equal(licenseBadgeText("full", undefined, now), null);
    assert.equal(licenseBadgeText("full", "2026-10-17T11:00:00Z", now), "Trial · 7 days left");
    assert.equal(licenseBadgeText("preview", "2026-10-10T23:00:00Z", now), "Preview · ends today");
    assert.equal(licenseBadgeText("preview", undefined, now), "Preview");
  });
});
