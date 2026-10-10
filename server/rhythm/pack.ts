/** ZIP of one Standard MIDI File per part plus a README, for the BOSS RC Rhythm Converter. */
import { strToU8, zipSync } from "fflate";
import { PART_FILE_NAMES, songSlug, type PartEvents } from "../../web/src/rhythmConverter/exportPack.js";
import { PART_LABELS } from "../../web/src/rhythmConverter/sectionSuggest.js";
import { writeSmf0 } from "./smfWriter.js";

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
  return { fileName: `${slug}_rc600_rhythm.zip`, bytes: zipSync(files) };
}
