import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { audioInputConstraints, preferredAudioInput } from "./input";

function device(label: string, deviceId: string): MediaDeviceInfo {
  return { label, deviceId, kind: "audioinput", groupId: "", toJSON: () => ({}) };
}

describe("shared audio input", () => {
  it("requests unprocessed stereo audio from a selected endpoint", () => {
    assert.deepEqual(audioInputConstraints("rc600", true), {
      deviceId: { exact: "rc600" },
      channelCount: { ideal: 2 },
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    });
  });

  it("prefers the RC-600 over generic audio inputs", () => {
    const selected = preferredAudioInput([
      device("Built-in microphone", "default"),
      device("Interface (RC-600 USB Audio)", "rc600"),
    ]);
    assert.equal(selected?.deviceId, "rc600");
  });
});
