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
  createSetlistTransferArchive,
  mergeImportedSetlists,
  parseSetlistTransferFile,
  parseSetlistTransfer,
} from "./playlistTransfer.js";
import { createUserSetlistStore } from "./userPlaylistStore.js";
import { createMemoryScoreAssetStore } from "../setlists/scoreAssetStore.js";

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

  it("migrates v2 songs without music settings", () => {
    const parsed = parseSetlistCatalog({
      version: 2,
      setlists: [setlist],
    });
    assert.equal(parsed[0]?.songs[0]?.music, undefined);
    assert.equal(parsed[0]?.songs[0]?.voiceToneMatch, undefined);
  });

  it("migrates v3 music to scrolling guides and disables Voice Tone Match without a confirmed key", () => {
    const parsed = parseSetlistCatalog({
      version: 3,
      setlists: [{
        ...setlist,
        songs: [{
          ...setlist.songs[0],
          music: {
            kind: "chart",
            source: "{key: G}\r\n[G]Hello",
            key: "G",
            mode: "major",
            transpose: 20,
            autoScrollSeconds: 180,
            performanceNotes: "  Start after the count-in.  ",
            tempoGuide: {
              mode: "original",
              bpm: 500,
              beatsPerBar: 4,
              beatUnit: 4,
              countInBars: 2,
              timeline: [{ chord: "G", beats: 4 }, { chord: "D/F#", beats: 4 }],
            },
          },
          voiceToneMatch: { enabled: true },
        }, {
          ...setlist.songs[1],
          music: { kind: "chords", source: "Am F C G", key: "", mode: "minor", transpose: 0 },
          voiceToneMatch: { enabled: true },
        }],
      }],
    });
    const migrated = parsed[0]?.songs[0]?.music;
    assert.equal(migrated?.kind, "scroll");
    assert.equal(migrated?.kind === "scroll" ? migrated.format : null, "chart");
    assert.equal(migrated?.kind === "scroll" ? migrated.source : null, "{key: G}\n[G]Hello");
    assert.equal(migrated?.transpose, 12);
    assert.equal(migrated?.performanceNotes, "Start after the count-in.");
    assert.equal(parsed[0]?.songs[0]?.voiceToneMatch?.enabled, true);
    assert.equal(parsed[0]?.songs[1]?.voiceToneMatch?.enabled, false);
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

  it("normalizes alphaTab score guide settings", () => {
    const parsed = parseSetlistCatalog({
      version: 4,
      setlists: [{
        ...setlist,
        songs: [{
          ...setlist.songs[0],
          music: {
            kind: "score",
            liveView: "scroll",
            scrollGuide: {
              kind: "scroll",
              format: "chart",
              source: "[D]Lyrics",
              key: "D",
              mode: "major",
              transpose: 0,
              autoScrollSeconds: 200,
            },
            assetId: "abc123",
            fileName: "song.gp",
            byteLength: 2048,
            selectedTrackIndexes: [2, 0, 2, -1],
            mutedTrackIndexes: [1, 1, -1],
            vocalTrackIndex: 2,
            rc600Drums: true,
            drumTrackIndex: 3,
            key: "D",
            mode: "major",
            transpose: 0,
            metronome: true,
            countIn: true,
            scoreAudio: false,
            playbackSpeed: 5,
          },
        }],
      }],
    });
    const music = parsed[0]?.songs[0]?.music;
    assert.equal(music?.kind, "score");
    assert.deepEqual(music?.kind === "score" ? music.selectedTrackIndexes : [], [2, 0]);
    assert.deepEqual(music?.kind === "score" ? music.mutedTrackIndexes : [], [1]);
    assert.equal(music?.kind === "score" ? music.playbackSpeed : 0, 2);
    assert.equal(music?.kind === "score" ? music.vocalTrackIndex : null, 2);
    assert.equal(music?.kind === "score" ? music.rc600Drums : false, true);
    assert.equal(music?.kind === "score" ? music.drumTrackIndex : null, 3);
    assert.equal(music?.kind === "score" ? music.liveView : null, "scroll");
    assert.equal(
      music?.kind === "score" ? music.scrollGuide?.source : null,
      "[D]Lyrics",
    );
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
    const withMusic: Setlist = {
      ...setlist,
      songs: setlist.songs.map((song, index) =>
        index === 0
          ? {
              ...song,
              music: {
                kind: "scroll",
                format: "chart",
                source: "{key: G}\n[G]Opening [D]song",
                key: "G",
                mode: "major",
                transpose: 2,
              },
              voiceToneMatch: { enabled: true },
            }
          : song,
      ),
    };
    const bundle = createSetlistTransfer([withMusic]);
    assert.equal(bundle.type, "boss-setlists");
    assert.equal(bundle.version, 4);
    const parsed = parseSetlistTransfer(JSON.parse(JSON.stringify(bundle)));
    assert.equal(parsed.setlists[0]?.songs[0]?.beforeChange.length, 1);
    const importedMusic = parsed.setlists[0]?.songs[0]?.music;
    assert.equal(importedMusic?.kind === "scroll" ? importedMusic.source : null, "{key: G}\n[G]Opening [D]song");
    assert.equal(parsed.setlists[0]?.songs[0]?.voiceToneMatch?.enabled, true);
    const merged = mergeImportedSetlists([{ ...setlist, name: "Old" }], parsed.setlists);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.name, "Friday at Venue A");
  });

  it("accepts a legacy v2 transfer bundle", () => {
    const parsed = parseSetlistTransfer({
      type: "rc600-setlists",
      version: 2,
      exportedAt: "2026-01-01T00:00:00.000Z",
      setlists: { version: 2, setlists: [setlist] },
    });
    assert.equal(parsed.setlists[0]?.songs[0]?.name, "Opening Song");
  });

  it("accepts a boss-setlists transfer bundle", () => {
    const parsed = parseSetlistTransfer({
      type: "boss-setlists",
      version: 4,
      exportedAt: "2026-01-01T00:00:00.000Z",
      setlists: { version: 4, setlists: [setlist] },
    });
    assert.equal(parsed.setlists[0]?.songs[0]?.name, "Opening Song");
  });

  it("packages score assets in a v4 ZIP transfer", async () => {
    const assets = createMemoryScoreAssetStore();
    const asset = await assets.put("performance.gp", new Uint8Array([1, 4, 9, 16]));
    const withScore: Setlist = {
      ...setlist,
      songs: [{
        ...setlist.songs[0]!,
        music: {
          kind: "score",
          assetId: asset.id,
          fileName: asset.fileName,
          byteLength: asset.bytes.byteLength,
          selectedTrackIndexes: [0],
          key: "C",
          mode: "major",
          transpose: 0,
          metronome: true,
          countIn: true,
          scoreAudio: false,
          playbackSpeed: 1,
        },
      }],
    };
    const archive = await createSetlistTransferArchive([withScore], assets);
    const parsed = await parseSetlistTransferFile(
      new File([new Uint8Array(archive)], "setlists.zip", { type: "application/zip" }),
    );
    assert.equal(parsed.setlists[0]?.songs[0]?.music?.kind, "score");
    assert.deepEqual(parsed.assets?.[0]?.bytes, new Uint8Array([1, 4, 9, 16]));
  });

  it("rejects unrelated JSON imports", () => {
    assert.throws(() => parseSetlistTransfer({ version: 2 }), /setlist file/i);
  });
});
