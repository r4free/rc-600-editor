/** RC-600 phrase WAV: IEEE float, 44.1 kHz, stereo, 32-bit (fmt chunk size 28). */

export const RC600_SAMPLE_RATE = 44100;
export const RC600_CHANNELS = 2;
export const RC600_BITS = 32;
export const RC600_BLOCK_ALIGN = 8; // 2 * 4
export const RC600_BYTE_RATE = RC600_SAMPLE_RATE * RC600_BLOCK_ALIGN;

export type WavInfo = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  format: number;
  frames: number;
  dataOffset: number;
  dataByteLength: number;
};

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Encode interleaved stereo float32 samples as an RC-600-compatible WAV. */
export function encodeRc600Wav(interleavedStereo: Float32Array): Uint8Array {
  if (interleavedStereo.length % RC600_CHANNELS !== 0) {
    throw new Error("Stereo buffer length must be even (L/R interleaved)");
  }
  const frames = interleavedStereo.length / RC600_CHANNELS;
  const dataBytes = frames * RC600_BLOCK_ALIGN;
  // fmt (8+28) + data (8+dataBytes); RIFF size excludes the 8-byte RIFF header
  const riffSize = 4 + (8 + 28) + (8 + dataBytes);
  const out = new Uint8Array(8 + riffSize);
  const view = new DataView(out.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, riffSize, true);
  writeAscii(view, 8, "WAVE");

  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 28, true); // WAVEFORMATEX with cbSize=10 (matches pedal)
  view.setUint16(20, 3, true); // IEEE float
  view.setUint16(22, RC600_CHANNELS, true);
  view.setUint32(24, RC600_SAMPLE_RATE, true);
  view.setUint32(28, RC600_BYTE_RATE, true);
  view.setUint16(32, RC600_BLOCK_ALIGN, true);
  view.setUint16(34, RC600_BITS, true);
  view.setUint16(36, 10, true); // cbSize
  // 10 extension bytes left as zeros (offsets 38–47)

  writeAscii(view, 48, "data");
  view.setUint32(52, dataBytes, true);
  out.set(new Uint8Array(interleavedStereo.buffer, interleavedStereo.byteOffset, dataBytes), 56);

  return out;
}

/** Parse a WAV header enough to locate PCM/float data. */
export function parseWavInfo(bytes: Uint8Array): WavInfo {
  if (bytes.length < 12) throw new Error("File too small to be a WAV");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const wave = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  if (riff !== "RIFF" || wave !== "WAVE") throw new Error("Not a RIFF WAVE file");

  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataByteLength = 0;
  let o = 12;

  while (o + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
    const size = view.getUint32(o + 4, true);
    const body = o + 8;
    if (id === "fmt " && size >= 16) {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === "data") {
      dataOffset = body;
      dataByteLength = size;
      break;
    }
    o = body + size + (size % 2);
  }

  if (dataOffset < 0) throw new Error("WAV has no data chunk");
  if (!channels || !sampleRate || !bitsPerSample) throw new Error("WAV is missing fmt chunk");

  const bytesPerFrame = channels * (bitsPerSample / 8);
  const frames = bytesPerFrame > 0 ? Math.floor(dataByteLength / bytesPerFrame) : 0;

  return { sampleRate, channels, bitsPerSample, format, frames, dataOffset, dataByteLength };
}

/** Read IEEE float stereo (or mono→duplicated) samples from an RC-600 WAV. */
export function decodeRc600FloatStereo(bytes: Uint8Array): Float32Array {
  const info = parseWavInfo(bytes);
  if (info.format !== 3) throw new Error(`Expected IEEE float WAV (format 3), got ${info.format}`);
  if (info.bitsPerSample !== 32) throw new Error(`Expected 32-bit float, got ${info.bitsPerSample}`);
  if (info.channels !== 1 && info.channels !== 2) {
    throw new Error(`Expected mono or stereo, got ${info.channels} channels`);
  }

  // Copy into a fresh ArrayBuffer so the Float32 view is always aligned.
  const raw = bytes.subarray(info.dataOffset, info.dataOffset + info.dataByteLength);
  const aligned = new Float32Array(Math.floor(raw.byteLength / 4));
  new Uint8Array(aligned.buffer).set(raw);

  if (info.channels === 2) return aligned;

  const out = new Float32Array(info.frames * 2);
  for (let i = 0; i < info.frames; i++) {
    const s = aligned[i] ?? 0;
    out[i * 2] = s;
    out[i * 2 + 1] = s;
  }
  return out;
}

/**
 * Build a Web Audio AudioBuffer from RC-600 (or decodeAudioData-compatible) WAV bytes.
 * Prefers the native IEEE-float path used by the pedal.
 */
export async function wavBytesToAudioBuffer(
  ctx: {
    sampleRate: number;
    createBuffer: (channels: number, length: number, sampleRate: number) => {
      getChannelData: (channel: number) => Float32Array;
      length: number;
      numberOfChannels: number;
      sampleRate: number;
    };
    decodeAudioData: (data: ArrayBuffer) => Promise<{
      getChannelData: (channel: number) => Float32Array;
      length: number;
      numberOfChannels: number;
      sampleRate: number;
    }>;
  },
  bytes: Uint8Array,
): Promise<{
  getChannelData: (channel: number) => Float32Array;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
}> {
  let info: WavInfo | null = null;
  try {
    info = parseWavInfo(bytes);
  } catch {
    info = null;
  }

  if (info && info.format === 3 && info.bitsPerSample === 32) {
    const interleaved = decodeRc600FloatStereo(bytes);
    const frames = interleaved.length / 2;
    const buffer = ctx.createBuffer(2, frames, info.sampleRate || RC600_SAMPLE_RATE);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < frames; i++) {
      left[i] = interleaved[i * 2] ?? 0;
      right[i] = interleaved[i * 2 + 1] ?? 0;
    }
    return buffer;
  }

  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return ctx.decodeAudioData(copy);
}

/** Interleave AudioBuffer channels to stereo Float32Array (duplicate mono, mix-down >2). */
export function audioBufferToStereoInterleaved(buffer: {
  numberOfChannels: number;
  length: number;
  getChannelData: (channel: number) => Float32Array;
}): Float32Array {
  const frames = buffer.length;
  const out = new Float32Array(frames * 2);
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) {
    for (let i = 0; i < frames; i++) {
      const s = ch0[i] ?? 0;
      out[i * 2] = s;
      out[i * 2 + 1] = s;
    }
    return out;
  }
  const ch1 = buffer.getChannelData(1);
  if (buffer.numberOfChannels === 2) {
    for (let i = 0; i < frames; i++) {
      out[i * 2] = ch0[i] ?? 0;
      out[i * 2 + 1] = ch1[i] ?? 0;
    }
    return out;
  }
  // Mix extra channels into L/R pairs
  for (let i = 0; i < frames; i++) {
    let l = 0;
    let r = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const s = buffer.getChannelData(c)[i] ?? 0;
      if (c % 2 === 0) l += s;
      else r += s;
    }
    const pairs = Math.ceil(buffer.numberOfChannels / 2);
    out[i * 2] = l / pairs;
    out[i * 2 + 1] = r / Math.max(1, Math.floor(buffer.numberOfChannels / 2));
  }
  return out;
}

export function durationSecondsFromFrames(frames: number, sampleRate = RC600_SAMPLE_RATE): number {
  return frames / sampleRate;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (m === 0) return `${s.toFixed(1)}s`;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
