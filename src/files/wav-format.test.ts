import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RC600_SAMPLE_RATE,
  decodeRc600FloatStereo,
  encodeRc600Wav,
  formatDuration,
  parseWavInfo,
} from "./wav-format.js";
import {
  EMPTY_PHRASE_TAGS,
  phraseDurationSeconds,
  phraseFrameCount,
  phraseTagsForClear,
  phraseTagsForImport,
  trackHasPhrase,
} from "./phrase-tags.js";
import { waveTrackDir, waveTrackFileName, waveTrackPath } from "./wave.js";

describe("wav-format RC-600 encode/decode", () => {
  it("encodes IEEE float stereo 44.1 kHz with fmt size 28", () => {
    const frames = 100;
    const interleaved = new Float32Array(frames * 2);
    for (let i = 0; i < frames; i++) {
      interleaved[i * 2] = 0.25;
      interleaved[i * 2 + 1] = -0.5;
    }
    const wav = encodeRc600Wav(interleaved);
    const info = parseWavInfo(wav);
    assert.equal(info.format, 3);
    assert.equal(info.channels, 2);
    assert.equal(info.sampleRate, RC600_SAMPLE_RATE);
    assert.equal(info.bitsPerSample, 32);
    assert.equal(info.frames, frames);
    assert.equal(info.dataOffset, 56);
    assert.equal(info.dataByteLength, frames * 8);

    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    assert.equal(view.getUint32(16, true), 28);
    assert.equal(view.getUint16(36, true), 10);

    const decoded = decodeRc600FloatStereo(wav);
    assert.equal(decoded.length, frames * 2);
    assert.ok(Math.abs((decoded[0] ?? 0) - 0.25) < 1e-6);
    assert.ok(Math.abs((decoded[1] ?? 0) - -0.5) < 1e-6);
  });

  it("rejects odd-length interleaved buffers", () => {
    assert.throws(() => encodeRc600Wav(new Float32Array(3)), /even/);
  });

  it("formats duration", () => {
    assert.equal(formatDuration(1.5), "1.5s");
    assert.equal(formatDuration(65.2), "1:05.2");
  });

  it("builds an AudioBuffer from RC-600 float WAV bytes", async () => {
    const frames = 8;
    const interleaved = new Float32Array(frames * 2);
    interleaved[0] = 0.5;
    interleaved[1] = -0.25;
    const wav = encodeRc600Wav(interleaved);

    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    const fakeCtx = {
      sampleRate: RC600_SAMPLE_RATE,
      createBuffer: () => ({
        getChannelData: (ch: number) => (ch === 0 ? left : right),
        length: frames,
        numberOfChannels: 2,
        sampleRate: RC600_SAMPLE_RATE,
      }),
      decodeAudioData: async () => {
        throw new Error("should not fall back");
      },
    };

    const { wavBytesToAudioBuffer } = await import("./wav-format.js");
    await wavBytesToAudioBuffer(fakeCtx, wav);
    assert.ok(Math.abs(left[0]! - 0.5) < 1e-6);
    assert.ok(Math.abs(right[0]! - -0.25) < 1e-6);
  });
});

describe("phrase-tags", () => {
  it("treats X>0 as recorded, not V", () => {
    assert.equal(trackHasPhrase({ V: "88200", X: "0", W: "0" }), false);
    assert.equal(trackHasPhrase({ V: "85440", X: "170880", W: "0" }), true);
    assert.equal(phraseFrameCount({ X: "170880" }), 170880);
    assert.ok(Math.abs(phraseDurationSeconds({ X: String(RC600_SAMPLE_RATE) }) - 1) < 1e-9);
  });

  it("builds import tags with X frames, V=X/2, W=1", () => {
    const tags = phraseTagsForImport(300848, 140.7);
    assert.equal(tags.X, "300848");
    assert.equal(tags.V, "150424");
    assert.equal(tags.W, "1");
    assert.equal(tags.Y, "2");
    assert.equal(tags.U, "1407");
  });

  it("clears to empty phrase defaults", () => {
    assert.deepEqual(phraseTagsForClear(), EMPTY_PHRASE_TAGS);
    assert.equal(EMPTY_PHRASE_TAGS.X, "0");
    assert.equal(EMPTY_PHRASE_TAGS.W, "0");
  });
});

describe("wave paths", () => {
  it("names WAVE/{NNN}_{T}/ folders", () => {
    assert.equal(waveTrackDir(1, 1), "WAVE/001_1");
    assert.equal(waveTrackDir(99, 6), "WAVE/099_6");
    assert.equal(waveTrackFileName(2, 3), "002_3.WAV");
    assert.equal(waveTrackPath(10, 1), "WAVE/010_1/010_1.WAV");
  });
});

describe("probeWaveAccess", () => {
  it("rejects a DATA-only handle", async () => {
    const { probeWaveAccess } = await import("./wave.js");
    const handle = {
      name: "DATA",
      entries: async function* () {},
      getDirectoryHandle: async () => {
        throw new Error("no");
      },
      getFileHandle: async () => {
        throw new Error("no");
      },
    } as unknown as import("./roland.js").DirectoryHandleLike;
    const probe = await probeWaveAccess(handle);
    assert.equal(probe.waveOk, false);
    assert.match(probe.message ?? "", /DATA/);
  });

  it("accepts a ROLAND handle that has WAVE", async () => {
    const { probeWaveAccess } = await import("./wave.js");
    const waveDir = {
      name: "WAVE",
      entries: async function* () {},
      getDirectoryHandle: async () => {
        throw new Error("no");
      },
      getFileHandle: async () => {
        throw new Error("no");
      },
    };
    const handle = {
      name: "ROLAND",
      entries: async function* () {
        yield ["WAVE", { kind: "directory" }] as [string, FileSystemHandle];
      },
      getDirectoryHandle: async (name: string) => {
        if (name.toUpperCase() === "WAVE") return waveDir;
        throw new Error("missing");
      },
      getFileHandle: async () => {
        throw new Error("no");
      },
    } as unknown as import("./roland.js").DirectoryHandleLike;
    const probe = await probeWaveAccess(handle);
    assert.equal(probe.waveOk, true);
    assert.equal(probe.waveDirName, "WAVE");
  });
});
