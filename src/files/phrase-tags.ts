import type { TagMap } from "../rc0/memory.js";
import { RC600_SAMPLE_RATE } from "./wav-format.js";

/** Empty-track phrase defaults from factory RC0. */
export const EMPTY_PHRASE_TAGS: TagMap = {
  J: "1",
  U: "1200",
  V: "88200",
  W: "0",
  X: "0",
  Y: "2",
};

export function phraseFrameCount(track: TagMap): number {
  const x = parseInt(track.X ?? "0", 10);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

export function trackHasPhrase(track: TagMap): boolean {
  return phraseFrameCount(track) > 0;
}

export function phraseDurationSeconds(track: TagMap): number {
  return phraseFrameCount(track) / RC600_SAMPLE_RATE;
}

/**
 * Tags to set after writing a WAV whose stereo frame count is `frames`.
 * X must match the WAV data chunk; W=1 marks a recorded phrase on the pedal.
 * V uses frames/2 (common for pedal-recorded stereo phrases).
 */
export function phraseTagsForImport(frames: number, tempoBpm: number | undefined): TagMap {
  const safeFrames = Math.max(0, Math.floor(frames));
  const tempo = tempoBpm != null && Number.isFinite(tempoBpm) && tempoBpm > 0 ? tempoBpm : 120;
  return {
    X: String(safeFrames),
    V: String(Math.floor(safeFrames / 2)),
    W: "1",
    Y: "2",
    U: String(Math.round(tempo * 10)),
  };
}

export function phraseTagsForClear(): TagMap {
  return { ...EMPTY_PHRASE_TAGS };
}
