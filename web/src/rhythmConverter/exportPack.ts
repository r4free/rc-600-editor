/** Normalizes suggested parts into RC Rhythm Converter–ready SMF files and a ZIP pack. */
import { strToU8, zipSync } from "fflate";
import { DRUM_INSTRUMENTS } from "../drumMap";
import type { DrumScore, PlayedBar } from "./scoreDrumEvents";
import { meterLabel } from "./scoreDrumEvents";
import {
  PART_LABELS,
  PART_ROLES,
  partLength,
  variationRoleFor,
  type FillRole,
  type PartPlan,
  type PartRole,
} from "./sectionSuggest";
import { SMF_PPQ, writeSmf0, type SmfNote } from "./smfWriter";

export type QuantizeGrid = "off" | "1/16" | "1/32" | "1/8T" | "1/16T";
export type FillLength = "half" | "bar";

export interface ConvertOptions {
  quantize: QuantizeGrid;
  /** Percent, 50–150. */
  velocityScale: number;
  humanize: boolean;
  fillLength: FillLength;
  dropNonKit: boolean;
}

export const DEFAULT_CONVERT_OPTIONS: ConvertOptions = {
  quantize: "1/16",
  velocityScale: 100,
  humanize: false,
  fillLength: "bar",
  dropNonKit: true,
};

export const QUANTIZE_OPTIONS: { value: QuantizeGrid; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "1/16", label: "1/16" },
  { value: "1/32", label: "1/32" },
  { value: "1/8T", label: "1/8 Triplet" },
  { value: "1/16T", label: "1/16 Triplet" },
];

const GRID_TICKS: Record<Exclude<QuantizeGrid, "off">, number> = {
  "1/16": SMF_PPQ / 4,
  "1/32": SMF_PPQ / 8,
  "1/8T": SMF_PPQ / 3,
  "1/16T": SMF_PPQ / 6,
};

const NOTE_LENGTH = SMF_PPQ / 8;

const KIT_NOTES = new Set(DRUM_INSTRUMENTS.map((i) => i.note));

/** Guitar Pro / GM2 extras outside the RC-600 kit range → nearest kit sound. */
const GM_REMAP: Record<number, number> = {
  27: 36, // High Q
  28: 38, // Slap
  29: 39, // Scratch push
  30: 39, // Scratch pull
  31: 37, // Sticks
  32: 37, // Square click
  82: 70, // Shaker
  83: 54, // Jingle bell
  84: 53, // Bell tree
  85: 75, // Castanets
  86: 41, // Mute surdo
  87: 41, // Open surdo
  91: 38, // Snare rim shot
  92: 46, // Hi-hat half open
  93: 51, // Ride edge
  94: 51, // Ride choke
  95: 55, // Splash choke
  96: 52, // China choke
  97: 49, // Crash high choke
  98: 57, // Crash medium choke
  99: 56, // Cowbell low
  100: 56, // Cowbell low tip
  101: 56, // Cowbell medium
  102: 56, // Cowbell high
  103: 56, // Cowbell high tip
  126: 49, // Piatti
  127: 36, // Grancassa
};

/** Kit note for `note`, or null when it should be dropped. */
export function mapToKit(note: number, dropNonKit: boolean): number | null {
  if (KIT_NOTES.has(note)) return note;
  const mapped = GM_REMAP[note];
  if (mapped != null) return mapped;
  return dropNonKit ? null : Math.max(0, Math.min(127, note));
}

export const PART_FILE_NAMES: Record<PartRole, string> = {
  intro: "01_Intro.mid",
  varA: "02_Var_A.mid",
  varB: "03_Var_B.mid",
  varC: "04_Var_C.mid",
  varD: "05_Var_D.mid",
  fillA: "06_Fill_A.mid",
  fillB: "07_Fill_B.mid",
  fillC: "08_Fill_C.mid",
  fillD: "09_Fill_D.mid",
  ending: "10_Ending.mid",
};

export interface PartEvents {
  role: PartRole;
  notes: SmfNote[];
  lengthTicks: number;
  tempoBpm: number;
  numerator: number;
  denominator: number;
  bars: number;
  /** Where the notes came from, for the README (e.g. `song bars 3–4`). */
  origin?: string;
}

/** Parts that replace the song bars for a role (e.g. picked from the library). */
export type PartOverrides = Partial<Record<PartRole, PartEvents>>;

/** Deterministic PRNG so the same file + options always export the same humanize offsets. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

interface RawHit {
  tick: number;
  note: number;
  velocity: number;
}

function barHits(bar: PlayedBar, scale: number, from = 0, to = Infinity): RawHit[] {
  return bar.hits
    .filter((h) => h.tick >= from && h.tick < to)
    .map((h) => ({ tick: h.tick * scale, note: h.note, velocity: h.velocity }));
}

/** Notes for one part in SMF ticks (480 PPQ), normalized with `options`. */
export function buildPartEvents(
  score: DrumScore,
  plan: PartPlan,
  role: PartRole,
  options: ConvertOptions,
): PartEvents | null {
  const part = plan[role];
  if (!part || partLength(part) === 0) return null;
  const bars = score.bars.slice(part.start, part.end);
  if (!bars.length) return null;
  const scale = SMF_PPQ / score.ppq;
  const first = bars[0]!;
  const raw: RawHit[] = [];
  let offset = 0;

  const isFill = role.startsWith("fill");
  const variation = isFill ? plan[variationRoleFor(role as FillRole)] : undefined;
  if (isFill && options.fillLength === "half" && bars.length === 1) {
    const half = first.lengthTicks / 2;
    const groove = variation ? score.bars[variation.start] : undefined;
    if (groove && groove.lengthTicks === first.lengthTicks) raw.push(...barHits(groove, scale, 0, half));
    raw.push(...barHits(first, scale, half));
    offset = first.lengthTicks * scale;
  } else {
    for (const bar of bars) {
      for (const h of barHits(bar, scale)) raw.push({ ...h, tick: h.tick + offset });
      offset += bar.lengthTicks * scale;
    }
  }
  const lengthTicks = Math.round(offset);

  const grid = options.quantize === "off" ? 0 : GRID_TICKS[options.quantize];
  const rand = rng(part.start * 977 + part.end * 131 + PART_ROLES.indexOf(role) + 1);
  const velScale = Math.max(50, Math.min(150, options.velocityScale)) / 100;
  const byKey = new Map<string, SmfNote>();
  for (const h of raw) {
    const note = mapToKit(h.note, options.dropNonKit);
    if (note == null) continue;
    let tick = grid ? Math.round(h.tick / grid) * grid : Math.round(h.tick);
    let velocity = h.velocity * velScale;
    if (options.humanize) {
      tick += Math.round((rand() - 0.5) * (SMF_PPQ / 48));
      velocity += (rand() - 0.5) * 12;
    }
    tick = Math.max(0, Math.min(lengthTicks - 1, tick));
    velocity = Math.max(1, Math.min(127, Math.round(velocity)));
    const key = `${tick}:${note}`;
    const prev = byKey.get(key);
    if (!prev || prev.velocity < velocity) byKey.set(key, { tick, note, velocity, duration: NOTE_LENGTH });
  }
  const notes = [...byKey.values()].sort((a, b) => a.tick - b.tick || a.note - b.note);
  return {
    role,
    notes,
    lengthTicks,
    tempoBpm: Math.round(first.tempo),
    numerator: first.numerator,
    denominator: first.denominator,
    bars: bars.length,
    origin: part.end - part.start === 1 ? `song bar ${part.start + 1}` : `song bars ${part.start + 1}-${part.end}`,
  };
}

/** Every role's notes: library overrides first, then the song bars in `plan` (when a score is open). */
export function resolveParts(
  score: DrumScore | null,
  plan: PartPlan,
  options: ConvertOptions,
  overrides: PartOverrides = {},
): PartEvents[] {
  return PART_ROLES.map((role) => {
    const own = overrides[role];
    if (own) return { ...own, role };
    return score ? buildPartEvents(score, plan, role, options) : null;
  }).filter((p): p is PartEvents => p !== null);
}

/** Parts whose bars use a meter other than `meter` (RC-600 rhythms have one Beat). */
export function meterMismatches(score: DrumScore, plan: PartPlan, meter: string | null): PartRole[] {
  if (!meter) return [];
  return PART_ROLES.filter((role) => {
    const p = plan[role];
    return p ? score.bars.slice(p.start, p.end).some((b) => meterLabel(b) !== meter) : false;
  });
}

export function songSlug(score: Pick<DrumScore, "title">, fileName: string): string {
  const base = score.title || fileName.replace(/\.[^.]+$/, "") || "rhythm";
  return (
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "rhythm"
  );
}

export function readmeText(songName: string, parts: readonly PartEvents[]): string {
  const lines = [
    `RC-600 rhythm pack: ${songName}`,
    "",
    "Files",
    ...parts.map((p) => {
      const origin = p.origin ? ` (${p.origin})` : "";
      return `  ${PART_FILE_NAMES[p.role].padEnd(16)} ${PART_LABELS[p.role].padEnd(12)} ${p.bars} bar(s), ${p.numerator}/${p.denominator}, ${p.tempoBpm} BPM${origin}`;
    }),
    "",
    "Import with BOSS RC Rhythm Converter",
    "  1. Download RC Rhythm Converter from boss.info (RC-600 support page) and install it.",
    "  2. Connect the RC-600 over USB and open RC Rhythm Converter.",
    "  3. File > Open MIDI File, and open each .mid file from this folder.",
    "  4. Place each file in the slot named in the list above (Intro, Variation A-D, Fill, Ending).",
    "     If the converter builds fills by itself, the Fill files can be skipped.",
    "  5. Set the tempo, time signature and kit, then transfer the pattern to the RC-600.",
    "  6. On the RC-600, pick it under Rhythm > Genre: USER.",
    "",
    "All files are Standard MIDI File format 0, channel 10, 480 ticks per quarter note,",
    "General MIDI drum notes, and whole bars only.",
    "",
  ];
  return lines.join("\r\n");
}

export interface RhythmPack {
  fileName: string;
  bytes: Uint8Array;
  parts: PartEvents[];
}

export function buildRhythmPack(parts: readonly PartEvents[], songName: string): RhythmPack {
  const slug = songSlug({ title: songName }, "");
  const files: Record<string, Uint8Array> = {};
  for (const p of parts) {
    files[`${slug}/${PART_FILE_NAMES[p.role]}`] = writeSmf0({
      name: `${slug} ${PART_LABELS[p.role]}`,
      tempoBpm: p.tempoBpm,
      numerator: p.numerator,
      denominator: p.denominator,
      lengthTicks: p.lengthTicks,
      notes: p.notes,
    });
  }
  files[`${slug}/README.txt`] = strToU8(readmeText(songName || slug, parts));
  return { fileName: `${slug}_rc600_rhythm.zip`, bytes: zipSync(files), parts: [...parts] };
}
