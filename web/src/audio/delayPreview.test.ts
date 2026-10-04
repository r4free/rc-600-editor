import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { delayTimeSec, delayTimeSteps, feedbackGain, nearestStep } from "./delayPreview";

describe("delay preview helpers", () => {
  it("reads note lengths from the tempo and the rest as milliseconds", () => {
    assert.equal(delayTimeSec(6, 120), 0.5);
    assert.equal(delayTimeSec(4, 120), 0.25);
    assert.equal(delayTimeSec(9, 120), 2);
    assert.equal(delayTimeSec(12, 120), 0.001);
    assert.equal(delayTimeSec(211, 120), 0.2);
    assert.equal(delayTimeSec(2011, 120), 2);
  });

  it("keeps feedback below runaway", () => {
    assert.equal(feedbackGain(0), 0);
    assert.ok(feedbackGain(100) < 1);
    assert.ok(feedbackGain(20) < feedbackGain(60));
  });

  it("scrubs every note, then milliseconds in growing steps", () => {
    const steps = delayTimeSteps();
    assert.deepEqual(steps.slice(0, 13), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.equal(steps.at(-1), 2011);
    assert.ok(steps.includes(211));
    assert.ok(steps.length < 300);
    assert.equal(steps[nearestStep(steps, 211)], 211);
    assert.equal(steps[nearestStep(steps, 213)], 211);
  });
});
