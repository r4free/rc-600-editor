import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waveTrackDirName } from "./wave-files.js";

function pickLargestWav(dir: string): { fileName: string; size: number } | null {
  if (!existsSync(dir)) return null;
  let best: { fileName: string; size: number } | null = null;
  for (const name of readdirSync(dir)) {
    if (!/\.WAV$/i.test(name)) continue;
    const st = statSync(join(dir, name));
    if (!st.isFile()) continue;
    if (!best || st.size > best.size) best = { fileName: name, size: st.size };
  }
  return best;
}

describe("wave-files helpers", () => {
  it("names track folders with zero-padded slot", () => {
    assert.equal(waveTrackDirName(12, 1), "012_1");
    assert.equal(waveTrackDirName(1, 6), "001_6");
  });

  it("picks the largest WAV including 8.3 names", () => {
    const root = mkdtempSync(join(tmpdir(), "rc600-wave-"));
    try {
      const dir = join(root, "012_1");
      mkdirSync(dir);
      writeFileSync(join(dir, "tiny.WAV"), Buffer.alloc(10));
      writeFileSync(join(dir, "AFTERL~1.WAV"), Buffer.alloc(1000));
      const hit = pickLargestWav(dir);
      assert.ok(hit);
      assert.equal(hit!.fileName, "AFTERL~1.WAV");
      assert.equal(hit!.size, 1000);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
