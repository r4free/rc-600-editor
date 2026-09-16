import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampMemorySlot,
  executeSetlistSong,
  parseSetlistCatalog,
  parseSetlistMidiAction,
  reorderSetlistSong,
  type Setlist,
} from "./playlist.js";
import {
  createSetlistTransfer,
  mergeImportedSetlists,
  parseSetlistTransfer,
} from "./playlistTransfer.js";
import { createUserSetlistStore } from "./userPlaylistStore.js";

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const setlist: Setlist = {
  id: "venue-a",
  name: "Friday at Venue A",
  updatedAt: "2026-09-16T00:00:00.000Z",
  songs: [
    {
      id: "song-a",
      name: "Opening Song",
      memorySlot: 1,
      memoryName: "Intro",
      beforeChange: [{ id: "cc-a", channel: 2, controller: 80, value: 127, delayMs: 250 }],
      afterChange: [],
    },
    {
      id: "song-b",
      name: "Final Song",
      memorySlot: 99,
      memoryName: "Finale",
      beforeChange: [],
      afterChange: [{ id: "cc-b", channel: 3, controller: 81, value: 0, delayMs: 100 }],
    },
  ],
};

describe("setlist", () => {
  it("clamps memory slots and MIDI action fields", () => {
    assert.equal(clampMemorySlot(150), 99);
    assert.deepEqual(parseSetlistMidiAction({
      id: "cc",
      channel: 22,
      controller: 200,
      value: -5,
      delayMs: 20_000,
    }), {
      id: "cc",
      channel: 16,
      controller: 127,
      value: 0,
      delayMs: 10_000,
    });
  });

  it("parses songs and ordered before/after actions", () => {
    const parsed = parseSetlistCatalog({ version: 2, setlists: [setlist] });
    assert.equal(parsed[0]?.songs[0]?.beforeChange[0]?.controller, 80);
    assert.equal(parsed[0]?.songs[1]?.afterChange[0]?.channel, 3);
  });

  it("migrates legacy playlist rhythm names into song names", () => {
    const parsed = parseSetlistCatalog({
      version: 1,
      playlists: [{
        id: "legacy",
        name: "Old playlist",
        items: [{ id: "old-song", presetId: "rock", presetName: "Rock Song", memorySlot: 4 }],
      }],
    });
    assert.equal(parsed[0]?.songs[0]?.name, "Rock Song");
    assert.equal(parsed[0]?.songs[0]?.memorySlot, 4);
  });

  it("reorders songs without wrapping", () => {
    assert.deepEqual(reorderSetlistSong(setlist.songs, "song-b", -1).map((song) => song.id), ["song-b", "song-a"]);
    assert.deepEqual(reorderSetlistSong(setlist.songs, "song-a", -1).map((song) => song.id), ["song-a", "song-b"]);
  });

  it("executes before CCs, Program Change, then after CCs in order", async () => {
    const events: string[] = [];
    await executeSetlistSong(setlist.songs[0]!, {
      sendControlChange: (action) => events.push(`cc:${action.controller}`),
      changeMemory: async (slot) => { events.push(`pc:${slot}`); },
      wait: async (ms) => { events.push(`wait:${ms}`); },
    });
    assert.deepEqual(events, ["cc:80", "wait:250", "pc:1"]);

    events.length = 0;
    await executeSetlistSong(setlist.songs[1]!, {
      sendControlChange: (action) => events.push(`cc:${action.controller}`),
      changeMemory: async (slot) => { events.push(`pc:${slot}`); },
      wait: async (ms) => { events.push(`wait:${ms}`); },
    });
    assert.deepEqual(events, ["pc:99", "cc:81", "wait:100"]);
  });

  it("persists and removes setlists", () => {
    const store = createUserSetlistStore(storage());
    store.upsert(setlist);
    assert.equal(store.list()[0]?.name, "Friday at Venue A");
    store.remove(setlist.id);
    assert.deepEqual(store.list(), []);
  });

  it("exports, imports, and merges setlists with MIDI automation", () => {
    const parsed = parseSetlistTransfer(JSON.parse(JSON.stringify(createSetlistTransfer([setlist]))));
    assert.equal(parsed.setlists[0]?.songs[0]?.beforeChange.length, 1);
    const merged = mergeImportedSetlists([{ ...setlist, name: "Old" }], parsed.setlists);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.name, "Friday at Venue A");
  });

  it("rejects unrelated JSON imports", () => {
    assert.throws(() => parseSetlistTransfer({ version: 2 }), /setlist file/i);
  });
});
