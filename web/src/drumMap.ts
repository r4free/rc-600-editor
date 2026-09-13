/** RC-600 rhythm-kit MIDI notes + Note On/Off encode for Play Drum pads. */

export interface DrumInstrument {
  note: number;
  label: string;
}

/** Instruments the RC-600 rhythm kit plays on Rx Rhythm CH (note → Kick, Snare, HH…). */
export const DRUM_INSTRUMENTS: readonly DrumInstrument[] = [
  { note: 35, label: "Kick 2" },
  { note: 36, label: "Kick" },
  { note: 37, label: "Rim" },
  { note: 38, label: "Snare" },
  { note: 39, label: "Clap" },
  { note: 40, label: "Snare 2" },
  { note: 41, label: "Tom Lo" },
  { note: 42, label: "HH Cl" },
  { note: 43, label: "Tom Md" },
  { note: 44, label: "HH Pd" },
  { note: 45, label: "Tom Hi" },
  { note: 46, label: "HH Op" },
  { note: 47, label: "Tom XH" },
  { note: 48, label: "Tom Hi 2" },
  { note: 49, label: "Crash" },
  { note: 50, label: "Tom Hi 3" },
  { note: 51, label: "Ride" },
  { note: 52, label: "China" },
  { note: 53, label: "Ride Bl" },
  { note: 54, label: "Tamb" },
  { note: 55, label: "Splash" },
  { note: 56, label: "Cowbell" },
  { note: 57, label: "Crash 2" },
  { note: 58, label: "VibraSlap" },
  { note: 59, label: "Ride 2" },
  { note: 60, label: "Bongo Hi" },
  { note: 61, label: "Bongo Lo" },
  { note: 62, label: "Conga MH" },
  { note: 63, label: "Conga Hi" },
  { note: 64, label: "Conga Lo" },
  { note: 65, label: "Timbale Hi" },
  { note: 66, label: "Timbale Lo" },
  { note: 67, label: "Agogo Hi" },
  { note: 68, label: "Agogo Lo" },
  { note: 69, label: "Cabasa" },
  { note: 70, label: "Maracas" },
  { note: 71, label: "Whistle Sh" },
  { note: 72, label: "Whistle Lo" },
  { note: 73, label: "Guiro Sh" },
  { note: 74, label: "Guiro Lo" },
  { note: 75, label: "Claves" },
  { note: 76, label: "Wood Hi" },
  { note: 77, label: "Wood Lo" },
  { note: 78, label: "Cuica Mu" },
  { note: 79, label: "Cuica Op" },
  { note: 80, label: "Tri Mu" },
  { note: 81, label: "Tri Op" },
] as const;

export const PAD_SLOT_COUNT = 16;
export const MIN_PAD_COUNT = 1;
export const MAX_PAD_COUNT = PAD_SLOT_COUNT;

/** Default 4×4 layout (slot index → rhythm-kit MIDI note). */
export const DEFAULT_PAD_NOTES: readonly number[] = [
  36, 38, 39, 37, 42, 46, 44, 56, 41, 43, 45, 47, 49, 51, 52, 53,
] as const;

/** RC-600 factory Rx Rhythm CH is 10 (1-based). Stored 0-based for MIDI status bytes. */
export const DEFAULT_RHYTHM_CHANNEL = 9;

export function drumLabelForNote(note: number): string {
  const hit = DRUM_INSTRUMENTS.find((i) => i.note === note);
  return hit?.label ?? `N${note}`;
}

export function clampDrumNote(note: number): number {
  if (!Number.isFinite(note)) return 36;
  return Math.max(0, Math.min(127, Math.round(note)));
}

export function defaultPadNotes(): number[] {
  return [...DEFAULT_PAD_NOTES];
}

export function clampPadCount(value: number): number {
  if (!Number.isFinite(value)) return PAD_SLOT_COUNT;
  return Math.max(MIN_PAD_COUNT, Math.min(MAX_PAD_COUNT, Math.round(value)));
}

export function padIdsForCount(padCount: number): number[] {
  return Array.from({ length: clampPadCount(padCount) }, (_, i) => i);
}

/** Fill or trim a note list to padCount, using the default layout for new slots. */
export function notesForPadCount(notes: readonly number[], padCount: number): number[] {
  const n = clampPadCount(padCount);
  const fallback = DEFAULT_PAD_NOTES;
  return Array.from({ length: n }, (_, i) =>
    clampDrumNote(Number(notes[i] ?? fallback[i] ?? 36)),
  );
}

/** Grid columns/rows for the visible pad count (3×3 for 9, otherwise up to 4 wide). */
export function padGridMetrics(padCount: number): { cols: number; rows: number } {
  const n = clampPadCount(padCount);
  if (n <= 4) return { cols: n, rows: 1 };
  if (n === 6) return { cols: 3, rows: 2 };
  if (n === 9) return { cols: 3, rows: 3 };
  const cols = 4;
  return { cols, rows: Math.ceil(n / cols) };
}

/** Clamp 0-based MIDI channel. */
export function clampMidiChannel(channel: number): number {
  if (!Number.isFinite(channel)) return DEFAULT_RHYTHM_CHANNEL;
  return Math.max(0, Math.min(15, Math.round(channel)));
}

/** Parse System MIDI Rx Rhythm CH (1–16 in XML/UI) → 0-based channel. */
export function parseRhythmChannel(value: string | number | undefined): number {
  if (value === undefined || value === "") return DEFAULT_RHYTHM_CHANNEL;
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 16) return n - 1;
    if (n === 0) return 0;
    return DEFAULT_RHYTHM_CHANNEL;
  }
  const text = String(value).trim();
  const m = /^Ch\.?\s*(\d+)$/i.exec(text);
  if (m) {
    const ch = Number(m[1]);
    if (ch >= 1 && ch <= 16) return ch - 1;
  }
  const n = Number(text);
  if (Number.isFinite(n) && n >= 1 && n <= 16) return Math.round(n) - 1;
  if (n === 0) return 0;
  return DEFAULT_RHYTHM_CHANNEL;
}

export function encodeNoteOn(channel: number, note: number, velocity: number): number[] {
  const ch = clampMidiChannel(channel);
  const n = Math.max(0, Math.min(127, note | 0));
  const v = Math.max(1, Math.min(127, velocity | 0));
  return [0x90 | ch, n, v];
}

/**
 * Release a note. Sends Note On velocity 0 (widely treated as Note Off) — some
 * paths ignore classic 0x8n Note Off, which left pads hanging sustain.
 */
export function encodeNoteOff(channel: number, note: number): number[] {
  const ch = clampMidiChannel(channel);
  const n = Math.max(0, Math.min(127, note | 0));
  return [0x90 | ch, n, 0];
}

/** Classic MIDI Note Off (0x8n) — also sent on release for stubborn receivers. */
export function encodeNoteOffStatus(channel: number, note: number): number[] {
  const ch = clampMidiChannel(channel);
  const n = Math.max(0, Math.min(127, note | 0));
  return [0x80 | ch, n, 0];
}

/** Both release encodings for a single note. */
export function encodeNoteRelease(channel: number, note: number): number[][] {
  return [encodeNoteOffStatus(channel, note), encodeNoteOff(channel, note)];
}

export function encodeControlChange(channel: number, controller: number, value: number): number[] {
  const ch = clampMidiChannel(channel);
  const cc = Math.max(0, Math.min(127, controller | 0));
  const v = Math.max(0, Math.min(127, value | 0));
  return [0xb0 | ch, cc, v];
}

export function encodeSustainOff(channel: number): number[] {
  return encodeControlChange(channel, 64, 0);
}

export function encodeAllSoundOff(channel: number): number[] {
  return encodeControlChange(channel, 120, 0);
}

export function encodeAllNotesOff(channel: number): number[] {
  return encodeControlChange(channel, 123, 0);
}

export function encodeChannelSilence(channel: number): number[][] {
  return [encodeSustainOff(channel), encodeAllSoundOff(channel), encodeAllNotesOff(channel)];
}
