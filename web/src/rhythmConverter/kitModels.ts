/**
 * Browser approximations of the 16 RC-600 rhythm kits (same order as the pedal's Kit list), built from
 * the bundled General MIDI kits plus drum-machine synth voices, tuning, tone, compression and room.
 * They only hint at each kit's character; the real kits play on the pedal over MIDI.
 */
import type { DrumClass } from "./sectionSuggest";

export type SynthSound =
  | "808-kick"
  | "909-kick"
  | "techno-kick"
  | "clap"
  | "909-snare"
  | "machine-hat"
  | "machine-cymbal"
  | "machine-tom"
  | "cajon-bass"
  | "cajon-slap"
  | "cajon-tone"
  | "shaker"
  | "tambourine";

export interface KitModel {
  /** GM drum kit in the bundled SoundFont: 0 Standard, 8 Room, 32 Jazz, 40 Brush. */
  program: number;
  /** Drum groups played by a synth voice instead of samples. */
  synth?: Partial<Record<DrumClass, SynthSound>>;
  /** Sample tuning per drum group, in semitones. */
  pitch?: Partial<Record<DrumClass, number>>;
  /** Level per drum group (1 = unchanged). */
  level?: Partial<Record<DrumClass, number>>;
  /** Scales velocities (below 1 plays softer and darker samples). */
  dynamics?: number;
  lowpass?: number;
  highpass?: number;
  /** Bus compression amount, 0–1. */
  compress?: number;
  /** Room reverb send, 0–1. */
  room?: number;
  /** Room length in seconds. */
  roomSeconds?: number;
}

const STANDARD = 0;
const ROOM = 8;
const JAZZ = 32;
const BRUSH = 40;

export const RC600_KIT_MODELS: readonly KitModel[] = [
  // Studio
  { program: STANDARD, compress: 0.35, room: 0.12, roomSeconds: 0.8 },
  // Live
  { program: ROOM, compress: 0.2, room: 0.32, roomSeconds: 1.5 },
  // Light
  { program: STANDARD, dynamics: 0.7, level: { kick: 0.8, snare: 0.75, cymbal: 0.7 }, lowpass: 7000, room: 0.15 },
  // Heavy
  {
    program: ROOM,
    pitch: { kick: -2, snare: -2, tom: -2 },
    level: { kick: 1.3, snare: 1.25 },
    compress: 0.7,
    room: 0.2,
  },
  // Rock
  { program: ROOM, level: { kick: 1.15, snare: 1.15 }, compress: 0.5, room: 0.22, roomSeconds: 1.2 },
  // Metal
  {
    program: STANDARD,
    pitch: { kick: 3, snare: 1 },
    level: { kick: 1.35, snare: 1.1, tom: 0.9 },
    highpass: 50,
    compress: 0.8,
    room: 0.1,
  },
  // Jazz
  { program: JAZZ, room: 0.2, roomSeconds: 1.2 },
  // Brush
  { program: BRUSH, room: 0.18 },
  // Cajon
  {
    program: STANDARD,
    synth: { kick: "cajon-bass", snare: "cajon-slap", tom: "cajon-tone", hat: "shaker", cymbal: "tambourine" },
    room: 0.12,
  },
  // Drum & Bass
  {
    program: STANDARD,
    pitch: { kick: 1, snare: 3, hat: 1 },
    level: { snare: 1.2 },
    highpass: 45,
    compress: 0.6,
    room: 0.08,
  },
  // R&B
  { program: STANDARD, pitch: { kick: -1, snare: -2 }, level: { hat: 0.8 }, lowpass: 9000, compress: 0.3, room: 0.18 },
  // Dance
  { program: STANDARD, synth: { kick: "909-kick", snare: "clap" }, compress: 0.5, room: 0.1 },
  // Techno
  {
    program: STANDARD,
    synth: { kick: "techno-kick", snare: "clap", hat: "machine-hat", cymbal: "machine-cymbal" },
    compress: 0.7,
    room: 0.08,
  },
  // Dance Beats
  { program: STANDARD, synth: { kick: "909-kick" }, pitch: { snare: 2 }, level: { kick: 1.2 }, compress: 0.55, room: 0.1 },
  // Hip Hop
  { program: STANDARD, synth: { kick: "808-kick" }, pitch: { snare: -3, hat: -1 }, lowpass: 8000, compress: 0.4, room: 0.1 },
  // 808+909
  {
    program: STANDARD,
    synth: { kick: "808-kick", snare: "909-snare", hat: "machine-hat", cymbal: "machine-cymbal", tom: "machine-tom" },
    room: 0.06,
  },
];

export function kitModel(kit: number): KitModel {
  return RC600_KIT_MODELS[kit] ?? RC600_KIT_MODELS[0]!;
}
