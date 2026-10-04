import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balanceLabel } from "./ParamControl";

describe("balance control label", () => {
  const style = { left: "Direct", right: "Lo-Fi" };

  it("reads Even at the center and the leaning side elsewhere", () => {
    assert.equal(balanceLabel(50, 0, 100, style), "Even");
    assert.equal(balanceLabel(70, 0, 100, style), "70% Lo-Fi");
    assert.equal(balanceLabel(20, 0, 100, style), "80% Direct");
    assert.equal(balanceLabel(100, 0, 100, style), "100% Lo-Fi");
    assert.equal(balanceLabel(0, 0, 100, style), "100% Direct");
  });
});
