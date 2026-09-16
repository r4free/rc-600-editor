import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPitch, frequencyToNote } from "./pitch";

function sineWave(frequency: number, sampleRate = 48_000, length = 8_192): Float32Array {
  return Float32Array.from(
    { length },
    (_, index) => 0.8 * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
  );
}

describe("tuner pitch", () => {
  it("maps concert A to A4 at zero cents", () => {
    assert.deepEqual(frequencyToNote(440), {
      name: "A",
      octave: 4,
      cents: 0,
      hz: 440,
      midi: 69,
    });
  });

  it("maps a guitar low E to E2", () => {
    const note = frequencyToNote(82.41);
    assert.equal(note?.name, "E");
    assert.equal(note?.octave, 2);
    assert.ok(Math.abs(note?.cents ?? 100) <= 1);
  });

  it("uses positive cents for sharp and negative cents for flat", () => {
    assert.ok((frequencyToNote(445)?.cents ?? 0) > 0);
    assert.ok((frequencyToNote(435)?.cents ?? 0) < 0);
  });

  it("detects generated guitar and concert pitches", () => {
    const a4 = detectPitch(sineWave(440), 48_000);
    const e2 = detectPitch(sineWave(82.41), 48_000);
    assert.ok(a4 !== null && Math.abs(a4 - 440) < 0.5, `A4 was ${a4}`);
    assert.ok(e2 !== null && Math.abs(e2 - 82.41) < 0.2, `E2 was ${e2}`);
  });

  it("ignores silence", () => {
    assert.equal(detectPitch(new Float32Array(8_192), 48_000), null);
  });

  it("rejects low-level input noise", () => {
    const noise = Float32Array.from(
      { length: 8_192 },
      (_, index) => ((((index * 1_103_515_245 + 12_345) >>> 8) % 2_048) / 2_048 - 0.5) * 0.002,
    );
    assert.equal(detectPitch(noise, 48_000), null);
  });
});
