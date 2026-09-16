import type { SongKeyMode } from "../presets/playlist";
import { notePitchClass, parseChord, scalePitchClasses } from "../setlists/chordChart";

const MAJOR_DEGREES = ["Root", "2nd", "3rd", "4th", "5th", "6th", "7th"] as const;
const MINOR_DEGREES = ["Root", "2nd", "Minor 3rd", "4th", "5th", "Minor 6th", "Minor 7th"] as const;
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10] as const;

export interface VoiceRelationship {
  inKey: boolean;
  degree: string | null;
  pitchClass: number;
}

export interface ChordRelationship {
  inChord: boolean;
  label: "Chord tone" | "Key tone" | "Outside key";
}

export interface VoiceStabilityState {
  candidateMidi: number | null;
  candidateSince: number;
  lastSeenAt: number;
  stableMidi: number | null;
}

export interface CompatibilityEvent {
  at: number;
  inKey: boolean;
}

export function initialVoiceStability(): VoiceStabilityState {
  return {
    candidateMidi: null,
    candidateSince: 0,
    lastSeenAt: 0,
    stableMidi: null,
  };
}

export function updateVoiceStability(
  state: VoiceStabilityState,
  midi: number | null,
  now: number,
  minStableMs = 140,
  staleMs = 400,
): VoiceStabilityState {
  if (midi === null) {
    if (state.lastSeenAt && now - state.lastSeenAt > staleMs) return initialVoiceStability();
    return state;
  }
  if (state.candidateMidi !== midi) {
    return {
      candidateMidi: midi,
      candidateSince: now,
      lastSeenAt: now,
      stableMidi: state.stableMidi,
    };
  }
  return {
    ...state,
    lastSeenAt: now,
    stableMidi: now - state.candidateSince >= minStableMs ? midi : state.stableMidi,
  };
}

export function classifyVoicePitch(
  midi: number,
  keyRoot: string,
  mode: SongKeyMode,
): VoiceRelationship {
  const tonic = notePitchClass(keyRoot);
  const pitchClass = ((midi % 12) + 12) % 12;
  if (tonic === null) return { inKey: false, degree: null, pitchClass };
  const steps = mode === "minor" ? MINOR_STEPS : MAJOR_STEPS;
  const degrees = mode === "minor" ? MINOR_DEGREES : MAJOR_DEGREES;
  const relative = (pitchClass - tonic + 12) % 12;
  const index = steps.indexOf(relative as never);
  return {
    inKey: scalePitchClasses(keyRoot, mode).has(pitchClass),
    degree: index >= 0 ? degrees[index]! : null,
    pitchClass,
  };
}

export function chordPitchClasses(chordToken: string): Set<number> {
  const chord = parseChord(chordToken);
  if (!chord) return new Set();
  const root = notePitchClass(chord.root);
  if (root === null) return new Set();
  const quality = chord.quality.toLowerCase();
  const intervals = quality.startsWith("dim") || quality.startsWith("°")
    ? [0, 3, 6]
    : quality.startsWith("aug") || quality.startsWith("+")
      ? [0, 4, 8]
      : quality.startsWith("sus2")
        ? [0, 2, 7]
        : quality.startsWith("sus")
          ? [0, 5, 7]
          : /^m(?!aj)/.test(quality)
            ? [0, 3, 7]
            : [0, 4, 7];
  if (/maj7/.test(quality)) intervals.push(11);
  else if (/7/.test(quality)) intervals.push(10);
  if (/(?:^|[^1])6/.test(quality) || /13/.test(quality)) intervals.push(9);
  if (/9/.test(quality)) intervals.push(2);
  if (/11/.test(quality)) intervals.push(5);
  return new Set(intervals.map((interval) => (root + interval) % 12));
}

export function classifyVoiceAgainstChord(
  midi: number,
  chordToken: string,
  keyRoot: string,
  mode: SongKeyMode,
): ChordRelationship {
  const pitchClass = ((midi % 12) + 12) % 12;
  const inChord = chordPitchClasses(chordToken).has(pitchClass);
  if (inChord) return { inChord: true, label: "Chord tone" };
  return {
    inChord: false,
    label: scalePitchClasses(keyRoot, mode).has(pitchClass) ? "Key tone" : "Outside key",
  };
}

export function rollingCompatibility(
  events: readonly CompatibilityEvent[],
  now: number,
  windowMs = 10_000,
): { percent: number | null; events: CompatibilityEvent[] } {
  const recent = events.filter((event) => now - event.at <= windowMs);
  if (!recent.length) return { percent: null, events: recent };
  const matches = recent.filter((event) => event.inKey).length;
  return { percent: Math.round((matches / recent.length) * 100), events: recent };
}
