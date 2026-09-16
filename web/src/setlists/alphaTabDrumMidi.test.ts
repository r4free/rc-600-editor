import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alphaTabDrumNote } from "./alphaTabDrumMidi";

describe("alphaTab RC-600 drum MIDI routing", () => {
  const channels = new Set([9]);

  it("forwards only note events from the selected score track channel", () => {
    assert.deepEqual(
      alphaTabDrumNote(
        { type: 128, channel: 9, noteKey: 36, noteVelocity: 110 },
        channels,
        128,
        144,
      ),
      { note: 36, velocity: 110, down: true },
    );
    assert.deepEqual(
      alphaTabDrumNote(
        { type: 144, channel: 9, noteKey: 36 },
        channels,
        128,
        144,
      ),
      { note: 36, velocity: 0, down: false },
    );
    assert.equal(
      alphaTabDrumNote(
        { type: 128, channel: 2, noteKey: 36, noteVelocity: 110 },
        channels,
        128,
        144,
      ),
      null,
    );
  });

  it("accepts standard MIDI commands when alphaTab event types are absent", () => {
    assert.equal(
      alphaTabDrumNote(
        { command: 0x99, channel: 9, noteKey: 42, noteVelocity: 80 },
        channels,
        128,
        144,
      )?.down,
      true,
    );
    assert.equal(
      alphaTabDrumNote(
        { command: 0x89, channel: 9, noteKey: 42, noteVelocity: 0 },
        channels,
        128,
        144,
      )?.down,
      false,
    );
  });
});
