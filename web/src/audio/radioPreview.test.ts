import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hzLabel, radioBars } from "../components/RadioLofiControl";
import { radioBand, radioLevelGain } from "./radioPreview";

describe("radio preview", () => {
  it("narrows the band and adds grit as Lo-Fi rises", () => {
    const clear = radioBand(1);
    const blurry = radioBand(10);
    assert.deepEqual([clear.lowHz, clear.highHz], [200, 6000]);
    assert.deepEqual([blurry.lowHz, blurry.highHz], [900, 1500]);
    assert.equal(clear.drive, 1);
    assert.ok(blurry.drive > clear.drive);
    assert.ok(blurry.noise > clear.noise);
    for (let v = 2; v <= 10; v++) {
      assert.ok(radioBand(v).lowHz >= radioBand(v - 1).lowHz);
      assert.ok(radioBand(v).highHz <= radioBand(v - 1).highHz);
    }
  });

  it("clamps Lo-Fi to 1–10", () => {
    assert.deepEqual(radioBand(0), radioBand(1));
    assert.deepEqual(radioBand(14), radioBand(10));
  });

  it("plays Level 50 at unity", () => {
    assert.equal(radioLevelGain(50), 1);
    assert.equal(radioLevelGain(0), 0);
    assert.equal(radioLevelGain(100), 2);
  });

  it("shows fewer passed bars as the band narrows", () => {
    const passed = (v: number) => radioBars(v).filter((b) => b.passed).length;
    assert.ok(passed(1) > passed(10));
    assert.ok(passed(10) > 0);
    const bars = radioBars(10);
    assert.equal(bars[0]!.passed, false);
    assert.equal(bars.at(-1)!.passed, false);
    assert.ok(bars.every((b) => b.height >= 10 && b.height <= 100));
  });

  it("labels frequencies", () => {
    assert.equal(hzLabel(200), "200 Hz");
    assert.equal(hzLabel(1500), "1.5 kHz");
    assert.equal(hzLabel(6000), "6 kHz");
  });
});
