import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseSf2 } from "./sf2.js";

const bank = parseSf2(new Uint8Array(readFileSync(new URL("../../public/soundfont/sonivox.sf2", import.meta.url))));

describe("sf2", () => {
  it("lists the bundled drum kits", () => {
    const drums = bank.presets.filter((p) => p.bank === 128).map((p) => `${p.program} ${p.name}`);
    assert.deepEqual(drums, ["0 Standard", "8 Room", "32 Jazz", "40 Brush"]);
  });

  it("resolves playable zones for core drum notes", () => {
    for (const program of [0, 8, 32, 40]) {
      for (const key of [36, 38, 42, 46, 49]) {
        const zones = bank.zones(128, program, key, 100);
        assert.ok(zones.length > 0, `kit ${program} key ${key}`);
        for (const z of zones) {
          assert.ok(z.end > z.start && z.end <= bank.pcm.length, "sample range inside PCM");
          assert.ok(z.playbackRate > 0.05 && z.playbackRate < 20);
          assert.ok(z.gain > 0 && z.gain <= 1);
        }
      }
    }
  });

  it("returns nothing for unknown presets and rejects other files", () => {
    assert.deepEqual(bank.zones(128, 99, 36, 100), []);
    assert.throws(() => parseSf2(new Uint8Array(16)), /SoundFont/);
  });
});
