/** Standard MIDI File → played drum bars, same shape as the Guitar Pro path. */
import {
  resolveTrackSelection,
  type DrumHit,
  type DrumScore,
  type PlayedBar,
  type ScoreTrackSummary,
} from "./scoreDrumEvents";

export const GM_DRUM_CHANNEL = 9;

interface MidiNote {
  tick: number;
  key: number;
  velocity: number;
}

interface MidiPart {
  /** Track × channel, so a format-0 file still splits into instruments. */
  index: number;
  name: string;
  channel: number;
  notes: MidiNote[];
}

export interface MidiSource {
  ppq: number;
  title: string;
  parts: MidiPart[];
  tempos: { tick: number; bpm: number }[];
  meters: { tick: number; numerator: number; denominator: number }[];
  markers: { tick: number; text: string }[];
  endTick: number;
}

export function isMidiFile(fileName: string, bytes: Uint8Array): boolean {
  return /\.midi?$/i.test(fileName) || String.fromCharCode(...bytes.subarray(0, 4)) === "MThd";
}

function ascii(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes).replace(/\0+$/, "").trim();
}

export function parseMidiFile(bytes: Uint8Array): MidiSource {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14 || ascii(bytes.subarray(0, 4)) !== "MThd") throw new Error("Not a Standard MIDI File.");
  const headerLen = view.getUint32(4);
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) throw new Error("SMPTE-timed MIDI files are not supported. Export with ticks per quarter note.");
  const ppq = division || 480;

  const parts = new Map<number, MidiPart>();
  const tempos: MidiSource["tempos"] = [];
  const meters: MidiSource["meters"] = [];
  const markers: MidiSource["markers"] = [];
  let title = "";
  let endTick = 0;
  let pos = 8 + headerLen;

  for (let t = 0; t < trackCount && pos + 8 <= bytes.length; t++) {
    const id = ascii(bytes.subarray(pos, pos + 4));
    const len = view.getUint32(pos + 4);
    const start = pos + 8;
    const end = Math.min(bytes.length, start + len);
    pos = start + len;
    if (id !== "MTrk") {
      t--;
      continue;
    }
    let p = start;
    let tick = 0;
    let status = 0;
    let trackName = "";
    const readVlq = () => {
      let v = 0;
      for (let i = 0; i < 4 && p < end; i++) {
        const b = bytes[p++]!;
        v = (v << 7) | (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      return v;
    };
    while (p < end) {
      tick += readVlq();
      let b = bytes[p]!;
      if (b & 0x80) {
        p++;
        if (b < 0xf0) status = b;
      } else {
        b = status;
      }
      if (b === 0xff) {
        const type = bytes[p++]!;
        const l = readVlq();
        const data = bytes.subarray(p, p + l);
        p += l;
        if (type === 0x03 && !trackName) trackName = ascii(data);
        else if (type === 0x06 || type === 0x07) {
          const text = ascii(data);
          if (text) markers.push({ tick, text });
        } else if (type === 0x51 && l >= 3) {
          const us = (data[0]! << 16) | (data[1]! << 8) | data[2]!;
          if (us > 0) tempos.push({ tick, bpm: 60_000_000 / us });
        } else if (type === 0x58 && l >= 2) {
          meters.push({ tick, numerator: data[0]!, denominator: 2 ** data[1]! });
        } else if (type === 0x2f) break;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        p += readVlq();
        continue;
      }
      const kind = b & 0xf0;
      const channel = b & 0x0f;
      const d1 = bytes[p++] ?? 0;
      const d2 = kind === 0xc0 || kind === 0xd0 ? 0 : (bytes[p++] ?? 0);
      if (kind === 0x90 && d2 > 0) {
        const index = t * 16 + channel;
        let part = parts.get(index);
        if (!part) {
          part = { index, name: "", channel, notes: [] };
          parts.set(index, part);
        }
        part.notes.push({ tick, key: d1, velocity: d2 });
      }
    }
    endTick = Math.max(endTick, tick);
    for (const part of parts.values()) {
      if (Math.floor(part.index / 16) === t && !part.name) part.name = trackName;
    }
    if (t === 0 && trackName && ![...parts.values()].some((p) => p.index < 16)) title = trackName;
  }

  for (const part of parts.values()) {
    const base = part.name || `Track ${Math.floor(part.index / 16) + 1}`;
    part.name = `${base} (Ch ${part.channel + 1})`;
    part.notes.sort((a, b) => a.tick - b.tick);
  }
  tempos.sort((a, b) => a.tick - b.tick);
  meters.sort((a, b) => a.tick - b.tick);
  markers.sort((a, b) => a.tick - b.tick);
  return {
    ppq,
    title,
    parts: [...parts.values()].sort((a, b) => a.index - b.index),
    tempos,
    meters,
    markers,
    endTick,
  };
}

function lastAt<T extends { tick: number }>(list: readonly T[], tick: number): T | undefined {
  let found: T | undefined;
  for (const item of list) {
    if (item.tick > tick) break;
    found = item;
  }
  return found;
}

/** Played bars from `trackIndices` (track × channel) merged together; channel 10 by default. */
export function extractMidiDrumScore(src: MidiSource, trackIndices?: readonly number[] | null): DrumScore {
  const tracks: ScoreTrackSummary[] = src.parts.map((p) => ({
    index: p.index,
    name: p.name,
    isPercussion: p.channel === GM_DRUM_CHANNEL || /drum|percussion|bateria/i.test(p.name),
    noteCount: p.notes.length,
  }));
  const chosen = resolveTrackSelection(tracks, trackIndices);
  const notes = src.parts
    .filter((p) => chosen.includes(p.index))
    .flatMap((p) => p.notes)
    .sort((a, b) => a.tick - b.tick || a.key - b.key);

  const lastNote = Math.max(-1, ...src.parts.map((p) => p.notes.at(-1)?.tick ?? -1));
  const songEnd = lastNote < 0 ? 0 : lastNote + 1;
  const bars: PlayedBar[] = [];
  let start = 0;
  let cursor = 0;
  let markerCursor = 0;
  while (start < songEnd) {
    const meter = lastAt(src.meters, start);
    const numerator = meter?.numerator || 4;
    const denominator = meter?.denominator || 4;
    const nextMeter = src.meters.find((m) => m.tick > start);
    let length = Math.round((numerator * src.ppq * 4) / denominator);
    if (nextMeter && nextMeter.tick < start + length) length = nextMeter.tick - start;
    const end = start + length;

    while (cursor < notes.length && notes[cursor]!.tick < start) cursor++;
    const hits: DrumHit[] = [];
    for (let j = cursor; j < notes.length && notes[j]!.tick < end; j++) {
      const n = notes[j]!;
      hits.push({ tick: n.tick - start, note: n.key, velocity: n.velocity });
    }
    let section: string | null = null;
    while (markerCursor < src.markers.length && src.markers[markerCursor]!.tick < end) {
      section ??= src.markers[markerCursor]!.text;
      markerCursor++;
    }
    bars.push({
      index: bars.length,
      masterBarIndex: bars.length,
      numerator,
      denominator,
      lengthTicks: length,
      tempo: lastAt(src.tempos, start)?.bpm ?? 120,
      section,
      hits,
    });
    start = end;
  }

  return { title: src.title, artist: "", ppq: src.ppq, tracks, trackIndices: chosen, bars };
}
