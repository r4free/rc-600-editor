import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adjacentMemorySlot,
  isLikelyRc600,
  isSecondaryUsbMidiPort,
  loadMidiPrefs,
  midiEnvironment,
  preferRc600Output,
  queryMidiPermission,
  rc600PortRank,
  saveMidiPrefs,
  shouldReloadSavedMemory,
  shouldReuseMidiAccess,
  shouldSyncPedalOnMemorySelect,
  midiSendChannels,
  initialMidiChannel,
  parseCtlProgramChange,
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

  it("picks a neighbor slot so same-memory Program Change can reload the kit", () => {
    assert.equal(adjacentMemorySlot(1), 2);
    assert.equal(adjacentMemorySlot(5), 4);
    assert.equal(adjacentMemorySlot(99), 98);
  });

  it("does not send a memory reload while USB Storage is still open", () => {
    assert.equal(shouldReloadSavedMemory({ midiConnected: true, usbStorageOpen: true }), false);
    assert.equal(shouldReloadSavedMemory({ midiConnected: false, usbStorageOpen: false }), false);
    assert.equal(shouldReloadSavedMemory({ midiConnected: true, usbStorageOpen: false }), true);
  });

  it("syncs the pedal when the editor selects a memory and MIDI is linked", () => {
    assert.equal(shouldSyncPedalOnMemorySelect({ midiConnected: true }), true);
    assert.equal(shouldSyncPedalOnMemorySelect({ midiConnected: false }), false);
    assert.equal(
      shouldSyncPedalOnMemorySelect({ midiConnected: true, usbStorageOpen: true }),
      false,
    );
  });

  it("reads memory slot from a CTL-channel Program Change", () => {
    assert.equal(parseCtlProgramChange([0xc0, 0], 0), 1);
    assert.equal(parseCtlProgramChange([0xc2, 4], 2), 5);
    assert.equal(parseCtlProgramChange([0xc1, 0], 0), null);
    assert.equal(parseCtlProgramChange([0x90, 36, 100], 0), null);
    assert.equal(parseCtlProgramChange([0xc2, 4], [0, 2]), 5);
    assert.equal(parseCtlProgramChange([0xc2, 4], [0, 1]), null);
  });

  it("sends kit and notes on every Rx channel the pedal might use", () => {
    assert.deepEqual(midiSendChannels(0), [0]);
    assert.deepEqual(midiSendChannels(0, 9), [0, 9]);
    assert.deepEqual(midiSendChannels(2, 2, 2), [2]);
    assert.deepEqual(midiSendChannels(0, 2, 9), [0, 2, 9]);
  });

  it("reuses a Play Drum Rx CH when the MIDI bar is still on channel 1", () => {
    assert.equal(initialMidiChannel({ channel: 0, rhythmChannel: 9 }), 0);
    assert.equal(initialMidiChannel({ channel: 0, rhythmChannel: 2 }), 2);
    assert.equal(initialMidiChannel({ channel: 4, rhythmChannel: 2 }), 4);
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
