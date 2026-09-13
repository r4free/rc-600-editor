import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLikelyRc600,
  isSecondaryUsbMidiPort,
  loadMidiPrefs,
  midiEnvironment,
  preferRc600Output,
  queryMidiPermission,
  rc600PortRank,
  saveMidiPrefs,
  shouldReuseMidiAccess,
} from "./rc600-midi.js";

describe("rc600 midi helpers", () => {
  it("detects RC-600 port names", () => {
    assert.equal(isLikelyRc600("RC-600"), true);
    assert.equal(isLikelyRc600("Boss RC 600"), true);
    assert.equal(isLikelyRc600("VG-800"), false);
  });

  it("prefers the main RC-600 USB port over MIDIOUT2", () => {
    assert.equal(isSecondaryUsbMidiPort("MIDIOUT2 (RC-600)"), true);
    assert.equal(isSecondaryUsbMidiPort("RC-600"), false);
    const ports = [
      { id: "2", name: "MIDIOUT2 (RC-600)", manufacturer: "BOSS" },
      { id: "1", name: "RC-600", manufacturer: "BOSS" },
    ];
    assert.equal(preferRc600Output(ports)?.id, "1");
    assert.equal(rc600PortRank("RC-600") < rc600PortRank("MIDIOUT2 (RC-600)"), true);
  });

  it("reports environment in node as unavailable or insecure", () => {
    const env = midiEnvironment();
    assert.ok(env.blockReason === "unavailable" || env.blockReason === "insecure" || env.blockReason === "ok");
  });

  it("reuses MIDI access after the origin already allowed it", () => {
    assert.equal(shouldReuseMidiAccess("granted", false), true);
    assert.equal(shouldReuseMidiAccess("granted", true), true);
    assert.equal(shouldReuseMidiAccess("unknown", true), true);
    assert.equal(shouldReuseMidiAccess("unknown", false), false);
    assert.equal(shouldReuseMidiAccess("prompt", true), false);
    assert.equal(shouldReuseMidiAccess("denied", true), false);
  });

  it("reports unknown MIDI permission in node", async () => {
    assert.equal(await queryMidiPermission(), "unknown");
  });

  it("persists MIDI session prefs in localStorage", () => {
    const store = new Map<string, string>();
    const previous = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
        key: () => null,
        length: 0,
      },
    });
    try {
      assert.deepEqual(loadMidiPrefs(), {
        allowed: false,
        outId: null,
        channel: 0,
        rhythmChannel: 9,
      });
      saveMidiPrefs({ allowed: true, outId: "out-1", channel: 3, rhythmChannel: 9 });
      assert.deepEqual(loadMidiPrefs(), {
        allowed: true,
        outId: "out-1",
        channel: 3,
        rhythmChannel: 9,
      });
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(globalThis, "localStorage");
      } else {
        Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous });
      }
    }
  });
});
