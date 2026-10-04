import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { euclid, randomPattern, RANDOM_STYLES } from "./stepRandom";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const pattern = (bits: boolean[]) => bits.map((b) => (b ? "x" : ".")).join("");

describe("euclid", () => {
  it("spreads hits evenly", () => {
    assert.equal(pattern(euclid(3, 8)), "x..x..x.");
    assert.equal(pattern(euclid(4, 16)), "x...x...x...x...");
    assert.equal(euclid(5, 16).filter(Boolean).length, 5);
  });

  it("rotates and clamps", () => {
    assert.equal(pattern(euclid(3, 8, 1)), "..x..x.x");
    assert.equal(pattern(euclid(20, 4)), "xxxx");
    assert.deepEqual(euclid(3, 0), []);
  });
});

describe("randomPattern", () => {
  for (const { id } of RANDOM_STYLES) {
    it(`${id} gives ${16} in-range steps with at least one hit`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        const p = randomPattern(16, id, seeded(seed));
        assert.equal(p.level.length, 16);
        assert.equal(p.length.length, 16);
        for (const v of [...p.level, ...p.length]) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100);
        assert.ok(p.level.some((v) => v > 0));
        if (id !== "any") assert.equal(p.style, id);
      }
    });
  }

  it("respects Step Max", () => {
    const p = randomPattern(5, "stutter", seeded(7));
    assert.equal(p.level.length, 5);
    assert.equal(p.length.length, 5);
  });

  it("keeps beat steps on in gate", () => {
    const p = randomPattern(16, "gate", seeded(3));
    for (const i of [0, 4, 8, 12]) assert.equal(p.level[i], 100);
  });
});
