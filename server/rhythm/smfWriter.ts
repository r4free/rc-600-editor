/** Minimal Standard MIDI File (Format 0) writer for drum parts. */

export const SMF_PPQ = 480;
export const GM_DRUM_CHANNEL = 9;

export interface SmfNote {
  tick: number;
  note: number;
  velocity: number;
  duration: number;
}

export interface SmfSpec {
  ppq?: number;
  name?: string;
  tempoBpm: number;
  numerator: number;
  denominator: number;
  /** End of track; the file is padded to this tick. */
  lengthTicks: number;
  channel?: number;
  notes: readonly SmfNote[];
}

export function encodeVlq(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function u16(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

interface TimedEvent {
  tick: number;
  /** Lower sorts first at the same tick (meta, note off, note on). */
  order: number;
  bytes: number[];
}

export function ticksPerBar(numerator: number, denominator: number, ppq = SMF_PPQ): number {
  return Math.round((ppq * 4 * numerator) / denominator);
}

export function writeSmf0(spec: SmfSpec): Uint8Array {
  const ppq = spec.ppq ?? SMF_PPQ;
  const ch = (spec.channel ?? GM_DRUM_CHANNEL) & 0x0f;
  const events: TimedEvent[] = [];
  if (spec.name) {
    const text = Array.from(new TextEncoder().encode(spec.name.slice(0, 64)));
    events.push({ tick: 0, order: 0, bytes: [0xff, 0x03, ...encodeVlq(text.length), ...text] });
  }
  const usPerQuarter = Math.round(60_000_000 / Math.max(1, spec.tempoBpm));
  events.push({
    tick: 0,
    order: 0,
    bytes: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff],
  });
  const denPow = Math.max(0, Math.round(Math.log2(spec.denominator)));
  events.push({ tick: 0, order: 0, bytes: [0xff, 0x58, 0x04, spec.numerator & 0xff, denPow, 24, 8] });

  const end = Math.max(1, Math.round(spec.lengthTicks));
  for (const n of spec.notes) {
    const on = Math.max(0, Math.min(end - 1, Math.round(n.tick)));
    const off = Math.max(on + 1, Math.min(end, Math.round(n.tick + n.duration)));
    const key = Math.max(0, Math.min(127, Math.round(n.note)));
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity)));
    events.push({ tick: on, order: 2, bytes: [0x90 | ch, key, vel] });
    events.push({ tick: off, order: 1, bytes: [0x80 | ch, key, 0] });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track: number[] = [];
  let last = 0;
  for (const e of events) {
    track.push(...encodeVlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  track.push(...encodeVlq(end - last), 0xff, 0x2f, 0x00);

  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), ...u16(0), ...u16(1), ...u16(ppq)];
  const chunk = [0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track];
  return new Uint8Array([...header, ...chunk]);
}
