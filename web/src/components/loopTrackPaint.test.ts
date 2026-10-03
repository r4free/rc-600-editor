import assert from "node:assert/strict";
import test from "node:test";
import type { TrackInputBit } from "@rc600/catalog/params";
import { paintTrackRange } from "./LoopTab";

const tracks: TrackInputBit[] = Array.from({ length: 6 }, (_, index) => ({
  bit: index,
  name: `Track ${index + 1}`,
  info: "",
}));

test("paintTrackRange turns on every crossed track in either direction", () => {
  assert.equal(paintTrackRange(0, tracks, 1, 4, true), 0b011110);
  assert.equal(paintTrackRange(0, tracks, 4, 1, true), 0b011110);
});

test("paintTrackRange turns off crossed tracks without changing the others", () => {
  assert.equal(paintTrackRange(0b111111, tracks, 4, 2, false), 0b100011);
});
