/** Minimal SoundFont 2 reader: enough to play one-shot drum zones (bank 128) with Web Audio. */

export interface Sf2Preset {
  name: string;
  bank: number;
  program: number;
}

export interface Sf2Zone {
  /** Sample frames in the shared PCM data. */
  start: number;
  end: number;
  loopStart: number;
  loopEnd: number;
  loop: boolean;
  sampleRate: number;
  /** Speed relative to the stored sample (pitch shift). */
  playbackRate: number;
  /** Linear gain from Initial Attenuation. */
  gain: number;
  /** -1 (left) … 1 (right). */
  pan: number;
  /** Notes with the same non-zero class cut each other (open/closed hi-hat). */
  exclusiveClass: number;
  /** Volume envelope, seconds (sustain is a 0–1 level). */
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface Sf2Bank {
  presets: Sf2Preset[];
  pcm: Int16Array;
  zones(bank: number, program: number, key: number, velocity: number): Sf2Zone[];
}

const GEN = {
  startOffset: 0,
  endOffset: 1,
  startLoopOffset: 2,
  endLoopOffset: 3,
  startCoarse: 4,
  endCoarse: 12,
  pan: 17,
  attackVol: 34,
  holdVol: 35,
  decayVol: 36,
  sustainVol: 37,
  releaseVol: 38,
  instrument: 41,
  keyRange: 43,
  velRange: 44,
  startLoopCoarse: 45,
  attenuation: 48,
  endLoopCoarse: 50,
  coarseTune: 51,
  fineTune: 52,
  sampleId: 53,
  sampleModes: 54,
  scaleTuning: 56,
  exclusiveClass: 57,
  rootKey: 58,
} as const;

type Gens = Map<number, number>;

interface Bag {
  gens: Gens;
  keyLo: number;
  keyHi: number;
  velLo: number;
  velHi: number;
}

function chunks(bytes: Uint8Array, start: number, end: number): Map<string, [number, number]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, [number, number]>();
  let p = start;
  while (p + 8 <= end) {
    const id = String.fromCharCode(...bytes.subarray(p, p + 4));
    const len = view.getUint32(p + 4, true);
    if (id === "LIST") {
      for (const [k, v] of chunks(bytes, p + 12, p + 8 + len)) out.set(k, v);
    } else {
      out.set(id, [p + 8, len]);
    }
    p += 8 + len + (len & 1);
  }
  return out;
}

function timecents(tc: number): number {
  return 2 ** (Math.max(-12000, Math.min(8000, tc)) / 1200);
}

function text(bytes: Uint8Array, at: number, len: number): string {
  let s = "";
  for (let i = 0; i < len && bytes[at + i]; i++) s += String.fromCharCode(bytes[at + i]!);
  return s.trim();
}

export function parseSf2(bytes: Uint8Array): Sf2Bank {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (text(bytes, 0, 4) !== "RIFF" || text(bytes, 8, 4) !== "sfbk") throw new Error("Not a SoundFont 2 file.");
  const c = chunks(bytes, 12, bytes.length);
  const need = (id: string) => {
    const v = c.get(id);
    if (!v) throw new Error(`SoundFont is missing ${id}.`);
    return v;
  };

  const [smplAt, smplLen] = need("smpl");
  const pcm = new Int16Array(bytes.slice(smplAt, smplAt + (smplLen & ~1)).buffer);

  function readGens(id: string): { oper: number; amount: number; lo: number; hi: number }[] {
    const [at, len] = need(id);
    const out = [];
    for (let o = at; o + 4 <= at + len; o += 4) {
      out.push({
        oper: view.getUint16(o, true),
        amount: view.getInt16(o + 2, true),
        lo: bytes[o + 2]!,
        hi: bytes[o + 3]!,
      });
    }
    return out;
  }
  function readBagIdx(id: string): number[] {
    const [at, len] = need(id);
    const out: number[] = [];
    for (let o = at; o + 4 <= at + len; o += 4) out.push(view.getUint16(o, true));
    return out;
  }

  const pgen = readGens("pgen");
  const igen = readGens("igen");
  const pbag = readBagIdx("pbag");
  const ibag = readBagIdx("ibag");

  function bags(bagIdx: number[], gens: ReturnType<typeof readGens>, from: number, to: number): Bag[] {
    const out: Bag[] = [];
    for (let b = from; b < to; b++) {
      const g: Gens = new Map();
      let keyLo = 0;
      let keyHi = 127;
      let velLo = 0;
      let velHi = 127;
      for (let i = bagIdx[b]!; i < (bagIdx[b + 1] ?? gens.length); i++) {
        const gen = gens[i]!;
        if (gen.oper === GEN.keyRange) {
          keyLo = gen.lo;
          keyHi = gen.hi;
        } else if (gen.oper === GEN.velRange) {
          velLo = gen.lo;
          velHi = gen.hi;
        } else if (gen.oper === GEN.instrument || gen.oper === GEN.sampleId) {
          g.set(gen.oper, gen.lo | (gen.hi << 8));
        } else {
          g.set(gen.oper, gen.amount);
        }
      }
      out.push({ gens: g, keyLo, keyHi, velLo, velHi });
    }
    return out;
  }

  const [phdrAt, phdrLen] = need("phdr");
  const presetRows: { preset: Sf2Preset; bagFrom: number; bagTo: number }[] = [];
  const phdrCount = phdrLen / 38;
  for (let i = 0; i < phdrCount - 1; i++) {
    const o = phdrAt + i * 38;
    presetRows.push({
      preset: { name: text(bytes, o, 20), program: view.getUint16(o + 20, true), bank: view.getUint16(o + 22, true) },
      bagFrom: view.getUint16(o + 24, true),
      bagTo: view.getUint16(o + 38 + 24, true),
    });
  }

  const [instAt, instLen] = need("inst");
  const instBags: Bag[][] = [];
  const instCount = instLen / 22;
  for (let i = 0; i < instCount - 1; i++) {
    const o = instAt + i * 22;
    instBags.push(bags(ibag, igen, view.getUint16(o + 20, true), view.getUint16(o + 22 + 20, true)));
  }

  const [shdrAt, shdrLen] = need("shdr");
  const samples: { start: number; end: number; loopStart: number; loopEnd: number; rate: number; pitch: number; correction: number }[] = [];
  for (let o = shdrAt; o + 46 <= shdrAt + shdrLen; o += 46) {
    samples.push({
      start: view.getUint32(o + 20, true),
      end: view.getUint32(o + 24, true),
      loopStart: view.getUint32(o + 28, true),
      loopEnd: view.getUint32(o + 32, true),
      rate: view.getUint32(o + 36, true),
      pitch: bytes[o + 40]!,
      correction: view.getInt8(o + 41),
    });
  }

  const presetBags = new Map<string, Bag[]>();
  for (const row of presetRows) {
    presetBags.set(`${row.preset.bank}:${row.preset.program}`, bags(pbag, pgen, row.bagFrom, row.bagTo));
  }

  const inRange = (b: Bag, key: number, vel: number) =>
    key >= b.keyLo && key <= b.keyHi && vel >= b.velLo && vel <= b.velHi;

  function zones(bank: number, program: number, key: number, velocity: number): Sf2Zone[] {
    const pz = presetBags.get(`${bank}:${program}`);
    if (!pz) return [];
    const pGlobal = pz[0] && !pz[0].gens.has(GEN.instrument) ? pz[0] : null;
    const out: Sf2Zone[] = [];
    for (const p of pz) {
      if (p === pGlobal || !p.gens.has(GEN.instrument) || !inRange(p, key, velocity)) continue;
      const ib = instBags[p.gens.get(GEN.instrument)!];
      if (!ib) continue;
      const iGlobal = ib[0] && !ib[0].gens.has(GEN.sampleId) ? ib[0] : null;
      for (const z of ib) {
        if (z === iGlobal || !z.gens.has(GEN.sampleId) || !inRange(z, key, velocity)) continue;
        const sh = samples[z.gens.get(GEN.sampleId)!];
        if (!sh) continue;
        const inst = (g: number, d = 0) => z.gens.get(g) ?? iGlobal?.gens.get(g) ?? d;
        const pre = (g: number) => (p.gens.get(g) ?? pGlobal?.gens.get(g) ?? 0);
        const gen = (g: number, d = 0) => inst(g, d) + pre(g);

        const start = sh.start + inst(GEN.startOffset) + inst(GEN.startCoarse) * 32768;
        const end = sh.end + inst(GEN.endOffset) + inst(GEN.endCoarse) * 32768;
        const loopStart = sh.loopStart + inst(GEN.startLoopOffset) + inst(GEN.startLoopCoarse) * 32768;
        const loopEnd = sh.loopEnd + inst(GEN.endLoopOffset) + inst(GEN.endLoopCoarse) * 32768;
        const overriding = inst(GEN.rootKey, -1);
        const root = overriding >= 0 ? overriding : sh.pitch <= 127 ? sh.pitch : 60;
        const scale = inst(GEN.scaleTuning, 100) + pre(GEN.scaleTuning);
        const semis = ((key - root) * scale) / 100 + gen(GEN.coarseTune) + (gen(GEN.fineTune) + sh.correction) / 100;
        const attenuation = Math.max(0, gen(GEN.attenuation));
        out.push({
          start,
          end: Math.max(start + 1, end),
          loopStart,
          loopEnd,
          loop: (inst(GEN.sampleModes) & 1) === 1 && loopEnd > loopStart,
          sampleRate: sh.rate || 44100,
          playbackRate: 2 ** (semis / 12),
          gain: 10 ** (-(attenuation * 0.4) / 200),
          pan: Math.max(-1, Math.min(1, gen(GEN.pan) / 500)),
          exclusiveClass: inst(GEN.exclusiveClass),
          attack: timecents(gen(GEN.attackVol, -12000)),
          hold: timecents(gen(GEN.holdVol, -12000)),
          decay: timecents(gen(GEN.decayVol, -12000)),
          sustain: 10 ** (-Math.max(0, Math.min(1440, gen(GEN.sustainVol))) / 200),
          release: timecents(gen(GEN.releaseVol, -12000)),
        });
      }
    }
    return out;
  }

  return { presets: presetRows.map((r) => r.preset), pcm, zones };
}
