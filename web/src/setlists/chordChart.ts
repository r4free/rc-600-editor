import type { SongKeyMode, SongMusicFormat } from "../presets/playlist";

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10] as const;

export interface ParsedChord {
  root: string;
  quality: string;
  bass?: string;
}

export interface ChartSegment {
  chord?: string;
  text: string;
}

export type ChartLine =
  | { kind: "blank" }
  | { kind: "section"; label: string }
  | { kind: "lyrics"; segments: ChartSegment[] }
  | { kind: "literal"; text: string };

export interface ParsedSongMusic {
  metadata: Record<string, string>;
  lines: ChartLine[];
  chords: string[];
}

export interface SuggestedKey {
  root: string;
  mode: SongKeyMode;
  score: number;
}

function asciiAccidentals(value: string): string {
  return value.replaceAll("♯", "#").replaceAll("♭", "b");
}

export function notePitchClass(note: string): number | null {
  const normalized = asciiAccidentals(note.trim());
  const letter = normalized[0]?.toUpperCase();
  if (!letter || !/[A-G]/.test(letter)) return null;
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pitch = natural[letter]!;
  if (normalized[1] === "#") pitch += 1;
  else if (normalized[1] === "b") pitch -= 1;
  return (pitch + 12) % 12;
}

export function parseChord(token: string): ParsedChord | null {
  const value = asciiAccidentals(token.trim());
  if (/^(?:N\.?C\.?|—|-)$/.test(value)) return null;
  const match = /^([A-Ga-g])([#b]?)([^/\s]*)(?:\/([A-Ga-g])([#b]?))?$/.exec(value);
  if (!match) return null;
  return {
    root: `${match[1]!.toUpperCase()}${match[2] ?? ""}`,
    quality: match[3] ?? "",
    ...(match[4]
      ? { bass: `${match[4].toUpperCase()}${match[5] ?? ""}` }
      : {}),
  };
}

function keyUsesFlats(keyRoot: string): boolean {
  return keyRoot.includes("b") || ["F"].includes(keyRoot);
}

export function transposeNote(note: string, semitones: number, preferFlats = false): string {
  const pitch = notePitchClass(note);
  if (pitch === null) return note;
  const next = (pitch + Math.round(semitones) % 12 + 12) % 12;
  return (preferFlats ? FLAT_NOTES : SHARP_NOTES)[next]!;
}

export function transposeChord(
  token: string,
  semitones: number,
  preferFlats?: boolean,
): string {
  const chord = parseChord(token);
  if (!chord || semitones === 0) return token;
  const flats = preferFlats ?? chord.root.includes("b");
  const root = transposeNote(chord.root, semitones, flats);
  const bass = chord.bass ? `/${transposeNote(chord.bass, semitones, flats)}` : "";
  return `${root}${chord.quality}${bass}`;
}

export function transposeKeyRoot(root: string, semitones: number): string {
  return transposeNote(root, semitones, keyUsesFlats(root));
}

function uniqueChords(chords: string[]): string[] {
  const seen = new Set<string>();
  return chords.filter((chord) => {
    if (seen.has(chord)) return false;
    seen.add(chord);
    return true;
  });
}

function parseLyricLine(line: string, chords: string[]): ChartLine {
  const chordPattern = /\[([^\]]+)\]/g;
  const matches = [...line.matchAll(chordPattern)];
  if (!matches.length) return { kind: "literal", text: line };

  const segments: ChartSegment[] = [];
  const prefix = line.slice(0, matches[0]!.index);
  if (prefix) segments.push({ text: prefix });
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const chord = match[1]!.trim();
    const nextStart =
      index + 1 < matches.length ? matches[index + 1]!.index : line.length;
    const text = line.slice(match.index + match[0].length, nextStart);
    if (parseChord(chord)) chords.push(chord);
    segments.push({ chord, text });
  }
  return { kind: "lyrics", segments };
}

function chordsFromProgression(source: string): string[] {
  const chords: string[] = [];
  for (const part of source.split(/(\s+|\|+|,+)/)) {
    const token = part.trim();
    if (token && parseChord(token)) chords.push(token);
  }
  return chords;
}

export function parseSongMusic(kind: SongMusicFormat, source: string): ParsedSongMusic {
  if (kind === "chords") {
    const chords = chordsFromProgression(source);
    return {
      metadata: {},
      chords: uniqueChords(chords),
      lines: source.split(/\r?\n/).map((text) =>
        text.trim() ? { kind: "literal", text } : { kind: "blank" },
      ),
    };
  }

  const metadata: Record<string, string> = {};
  const lines: ChartLine[] = [];
  const chords: string[] = [];
  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      lines.push({ kind: "blank" });
      continue;
    }
    const directive = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i.exec(line.trim());
    if (directive) {
      const name = directive[1]!.toLowerCase();
      const value = directive[2]?.trim() ?? "";
      if (["title", "artist", "key", "capo", "tempo", "time", "duration"].includes(name)) {
        metadata[name] = value;
      } else if (name.startsWith("start_of_")) {
        const fallback = name.slice("start_of_".length).replaceAll("_", " ");
        lines.push({ kind: "section", label: value || fallback });
      } else if (name === "comment" || name === "c") {
        lines.push({ kind: "section", label: value });
      }
      continue;
    }
    lines.push(parseLyricLine(line, chords));
  }
  return { metadata, lines, chords: uniqueChords(chords) };
}

export function transposeSongSource(
  kind: SongMusicFormat,
  source: string,
  semitones: number,
  keyRoot = "",
): string {
  if (!semitones) return source;
  const flats = keyUsesFlats(transposeKeyRoot(keyRoot || "C", semitones));
  if (kind === "chart") {
    return source
      .replace(/\[([^\]]+)\]/g, (whole, token: string) =>
        parseChord(token) ? `[${transposeChord(token, semitones, flats)}]` : whole,
      )
      .replace(
        /(\{\s*key\s*:\s*)([A-G](?:#|b)?)(\s*\})/gi,
        (_whole, prefix: string, root: string, suffix: string) =>
          `${prefix}${transposeKeyRoot(root, semitones)}${suffix}`,
      );
  }
  return source
    .split(/(\s+|\|+|,+)/)
    .map((part) => (parseChord(part.trim()) ? transposeChord(part, semitones, flats) : part))
    .join("");
}

export function scalePitchClasses(root: string, mode: SongKeyMode): Set<number> {
  const tonic = notePitchClass(root);
  if (tonic === null) return new Set();
  const steps = mode === "minor" ? MINOR_STEPS : MAJOR_STEPS;
  return new Set(steps.map((step) => (tonic + step) % 12));
}

function chordIsMinor(chord: ParsedChord): boolean {
  return /^m(?!aj)/i.test(chord.quality) || /^(?:dim|°)/i.test(chord.quality);
}

export function suggestKeys(chordTokens: readonly string[]): SuggestedKey[] {
  const chords = chordTokens.flatMap((token) => {
    const chord = parseChord(token);
    return chord ? [chord] : [];
  });
  if (!chords.length) return [];

  const candidates: SuggestedKey[] = [];
  for (let tonic = 0; tonic < 12; tonic += 1) {
    for (const mode of ["major", "minor"] as const) {
      const root = SHARP_NOTES[tonic]!;
      const scale = scalePitchClasses(root, mode);
      let score = 0;
      for (const [index, chord] of chords.entries()) {
        const pitch = notePitchClass(chord.root)!;
        score += scale.has(pitch) ? 2 : -3;
        if (pitch === tonic) {
          score += index === 0 ? 3 : 1;
          score += chordIsMinor(chord) === (mode === "minor") ? 2 : -1;
        }
      }
      candidates.push({ root, mode, score });
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}
