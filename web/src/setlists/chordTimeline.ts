import type { SetlistTimedChord } from "../presets/playlist";
import { parseChord, transposeChord } from "./chordChart";

export interface TimelinePosition {
  chord: string | null;
  index: number;
  line: number | null;
  section: string | null;
  beatInChord: number;
  beatsRemainingInChord: number;
  beatInBar: number;
  bar: number;
  progress: number;
  done: boolean;
}

export function transposeChordTimeline(
  timeline: readonly SetlistTimedChord[],
  semitones: number,
  preferFlats = false,
): SetlistTimedChord[] {
  return timeline.map((entry) => ({
    ...entry,
    chord: transposeChord(entry.chord, semitones, preferFlats),
  }));
}

export function parseChordTimeline(
  source: string,
  beatsPerBar = 4,
): SetlistTimedChord[] {
  const timeline: SetlistTimedChord[] = [];
  for (const rawBar of source.split("|")) {
    const tokens = rawBar.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const parsed = tokens.flatMap((token) => {
      const match = /^(.*?)(?:[:@](\d+(?:\.\d+)?))?(?:~(\d+))?$/.exec(token);
      const chord = match?.[1]?.trim() ?? "";
      if (!parseChord(chord)) return [];
      const explicit = match?.[2] ? Number(match[2]) : null;
      const line = match?.[3] ? Number(match[3]) : undefined;
      return [{
        chord,
        beats: explicit && explicit > 0 ? explicit : 0,
        ...(line ? { line } : {}),
      }];
    });
    if (!parsed.length) continue;
    const unspecified = parsed.filter((entry) => entry.beats === 0).length;
    const explicitBeats = parsed.reduce((sum, entry) => sum + entry.beats, 0);
    const shared = unspecified
      ? Math.max(0.25, (Math.max(beatsPerBar, explicitBeats) - explicitBeats) / unspecified)
      : 0;
    timeline.push(...parsed.map((entry) => ({
      ...entry,
      beats: entry.beats || shared,
    })));
  }
  return timeline.slice(0, 1_000);
}

export function formatChordTimeline(
  timeline: readonly SetlistTimedChord[],
  beatsPerBar = 4,
): string {
  if (!timeline.length) return "";
  const bars: string[] = [];
  let current: string[] = [];
  let beats = 0;
  for (const entry of timeline) {
    const duration = Math.max(0.25, entry.beats);
    current.push(
      `${Math.abs(duration - beatsPerBar) < 0.001
        ? entry.chord
        : `${entry.chord}:${Number(duration.toFixed(2))}`}${entry.line ? `~${entry.line}` : ""}`,
    );
    beats += duration;
    if (beats >= beatsPerBar - 0.001) {
      bars.push(current.join(" "));
      current = [];
      beats = 0;
    }
  }
  if (current.length) bars.push(current.join(" "));
  return `| ${bars.join(" | ")} |`;
}

export function timelinePositionAt(
  timeline: readonly SetlistTimedChord[],
  elapsedSeconds: number,
  bpm: number,
  beatsPerBar = 4,
): TimelinePosition {
  const totalBeats = timeline.reduce((sum, entry) => sum + entry.beats, 0);
  const elapsedBeats = Math.max(0, elapsedSeconds) * Math.max(20, bpm) / 60;
  let cursor = 0;
  for (let index = 0; index < timeline.length; index += 1) {
    const entry = timeline[index]!;
    if (elapsedBeats < cursor + entry.beats) {
      return {
        chord: entry.chord,
        index,
        line: entry.line ?? null,
        section: entry.section ?? null,
        beatInChord: elapsedBeats - cursor,
        beatsRemainingInChord: cursor + entry.beats - elapsedBeats,
        beatInBar: elapsedBeats % beatsPerBar,
        bar: Math.floor(elapsedBeats / beatsPerBar) + 1,
        progress: totalBeats ? Math.min(1, elapsedBeats / totalBeats) : 0,
        done: false,
      };
    }
    cursor += entry.beats;
  }
  return {
    chord: timeline.at(-1)?.chord ?? null,
    index: Math.max(0, timeline.length - 1),
    line: timeline.at(-1)?.line ?? null,
    section: timeline.at(-1)?.section ?? null,
    beatInChord: 0,
    beatsRemainingInChord: 0,
    beatInBar: elapsedBeats % beatsPerBar,
    bar: Math.floor(elapsedBeats / beatsPerBar) + 1,
    progress: timeline.length ? 1 : 0,
    done: timeline.length > 0,
  };
}
