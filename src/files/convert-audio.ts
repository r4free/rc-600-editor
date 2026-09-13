import {
  RC600_SAMPLE_RATE,
  audioBufferToStereoInterleaved,
  encodeRc600Wav,
} from "./wav-format.js";

type AudioContextLike = {
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBuffer>;
  close?: () => Promise<void>;
};

type OfflineAudioContextCtor = new (
  channels: number,
  length: number,
  sampleRate: number,
) => {
  destination: AudioNode;
  sampleRate: number;
  length: number;
  startRendering: () => Promise<AudioBuffer>;
  createBufferSource: () => {
    buffer: AudioBuffer | null;
    connect: (dest: AudioNode) => void;
    start: (when?: number) => void;
  };
};

/**
 * Decode any browser-supported audio file and convert to RC-600 WAV bytes
 * (44.1 kHz, stereo, 32-bit float).
 */
export async function convertAudioFileToRc600Wav(
  fileBytes: ArrayBuffer,
  opts?: {
    AudioContext?: new () => AudioContextLike;
    OfflineAudioContext?: OfflineAudioContextCtor;
  },
): Promise<{ wav: Uint8Array; frames: number }> {
  const AC =
    opts?.AudioContext ??
    (globalThis as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext;
  const OAC =
    opts?.OfflineAudioContext ??
    (globalThis as unknown as { OfflineAudioContext?: OfflineAudioContextCtor }).OfflineAudioContext;

  if (!AC || !OAC) {
    throw new Error("Web Audio API is unavailable in this browser");
  }

  const ctx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(fileBytes.slice(0));
  } finally {
    await ctx.close?.();
  }

  let rendered = decoded;
  if (decoded.sampleRate !== RC600_SAMPLE_RATE) {
    const frameCount = Math.max(1, Math.ceil(decoded.duration * RC600_SAMPLE_RATE));
    const offline = new OAC(decoded.numberOfChannels || 1, frameCount, RC600_SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    rendered = await offline.startRendering();
  }

  const interleaved = audioBufferToStereoInterleaved(rendered);
  const wav = encodeRc600Wav(interleaved);
  return { wav, frames: interleaved.length / 2 };
}
