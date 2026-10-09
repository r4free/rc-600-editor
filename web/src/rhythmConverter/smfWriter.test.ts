import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeVlq, ticksPerBar, writeSmf0 } from "./smfWriter.js";

function readVlq(bytes: Uint8Array, at: number): [number, number] {
  let value = 0;
  let i = at;
  for (;;) {
    const b = bytes[i++]!;
    value = (value << 7) | (b & 0x7f);
    if (!(b & 0x80)) return [value, i];
  }
}

/** Parses a Format 0 file into absolute-tick events (status + data). */
function parse(bytes: Uint8Array): { format: number; tracks: number; ppq: number; events: [number, number[]][] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "MThd");
  const format = view.getUint16(8);
  const tracks = view.getUint16(10);
  const ppq = view.getUint16(12);
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), "MTrk");
  const len = view.getUint32(18);
  const end = 22 + len;
  assert.equal(end, bytes.length);
  const events: [number, number[]][] = [];
  let i = 22;
  let tick = 0;
  while (i < end) {
    const [delta, next] = readVlq(bytes, i);
    i = next;
    tick += delta;
    const status = bytes[i]!;
    if (status === 0xff) {
      const type = bytes[i + 1]!;
      const [size, dataAt] = readVlq(bytes, i + 2);
      events.push([tick, [0xff, type, ...bytes.slice(dataAt, dataAt + size)]]);
      i = dataAt + size;
    } else {
      events.push([tick, [...bytes.slice(i, i + 3)]]);
      i += 3;
    }
  }
  return { format, tracks, ppq, events };
}

describe("encodeVlq", () => {
  it("encodes variable-length quantities", () => {
    assert.deepEqual(encodeVlq(0), [0x00]);
    assert.deepEqual(encodeVlq(0x7f), [0x7f]);
    assert.deepEqual(encodeVlq(0x80), [0x81, 0x00]);
    assert.deepEqual(encodeVlq(1920), [0x8f, 0x00]);
    assert.deepEqual(encodeVlq(0x0fffffff), [0xff, 0xff, 0xff, 0x7f]);
  });
});

describe("writeSmf0", () => {
  it("writes header, meta, channel 10 notes and pads to the bar end", () => {
    const bar = ticksPerBar(4, 4);
    const bytes = writeSmf0({
      name: "Variation A",
      tempoBpm: 120,
      numerator: 4,
      denominator: 4,
      lengthTicks: bar,
      notes: [
        { tick: 0, note: 36, velocity: 100, duration: 60 },
        { tick: 960, note: 38, velocity: 90, duration: 60 },
      ],
    });
    const smf = parse(bytes);
    assert.equal(smf.format, 0);
    assert.equal(smf.tracks, 1);
    assert.equal(smf.ppq, 480);
    const tempo = smf.events.find(([, e]) => e[0] === 0xff && e[1] === 0x51)!;
    assert.deepEqual(tempo[1].slice(2), [0x07, 0xa1, 0x20]);
    const meter = smf.events.find(([, e]) => e[0] === 0xff && e[1] === 0x58)!;
    assert.deepEqual(meter[1].slice(2, 4), [4, 2]);
    const notes = smf.events.filter(([, e]) => (e[0]! & 0xf0) === 0x90);
    assert.deepEqual(notes, [[0, [0x99, 36, 100]], [960, [0x99, 38, 90]]]);
    const offs = smf.events.filter(([, e]) => (e[0]! & 0xf0) === 0x80);
    assert.deepEqual(offs.map(([t]) => t), [60, 1020]);
    const eot = smf.events[smf.events.length - 1]!;
    assert.deepEqual(eot, [bar, [0xff, 0x2f]]);
  });

  it("keeps notes inside the part and orders note off before note on", () => {
    const bytes = writeSmf0({
      tempoBpm: 90,
      numerator: 6,
      denominator: 8,
      lengthTicks: ticksPerBar(6, 8),
      notes: [
        { tick: 0, note: 42, velocity: 80, duration: 240 },
        { tick: 240, note: 42, velocity: 80, duration: 5000 },
      ],
    });
    const smf = parse(bytes);
    const at240 = smf.events.filter(([t, e]) => t === 240 && e[0] !== 0xff).map(([, e]) => e[0]! & 0xf0);
    assert.deepEqual(at240, [0x80, 0x90]);
    const lastOff = smf.events.filter(([, e]) => (e[0]! & 0xf0) === 0x80).pop()!;
    assert.equal(lastOff[0], ticksPerBar(6, 8));
  });
});
