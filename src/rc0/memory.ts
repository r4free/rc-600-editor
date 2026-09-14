import {
  FX_BANKS,
  INPUT_EQ_SECTIONS,
  OUTPUT_EQ_SECTIONS,
  fxSlotSection,
  type InputEqSection,
  type OutputEqSection,
} from "../catalog/params.js";
import { FX_BLOCK_TAGS } from "../catalog/input-fx.js";
import {
  extractCount,
  findSection,
  getTagContent,
  activeSide,
  parseHexCount,
} from "./xml-ops.js";

export interface TagMap {
  [tag: string]: string;
}

export interface MemorySummary {
  slot: number;
  name: string;
  countA: string;
  countB: string;
  active: "a" | "b";
  tempo?: number;
}

export interface MemoryModel {
  slot: number;
  name: string;
  count: string;
  tracks: TagMap[];
  master: TagMap;
  rec: TagMap;
  play: TagMap;
  rhythm: TagMap;
  assigns: TagMap[];
  /** Pedal Mode 1–3 × Pedal 1–9 (ICTL{mode}_PEDAL{n}). */
  ctlPedals: TagMap[][];
  /** External CTL 1–4 (ECTL_CTL{n}). */
  ectlCtl: TagMap[];
  /** External EXP 1–2 (ECTL_EXP{n}). */
  ectlExp: TagMap[];
  input: TagMap;
  /** INPUT EQ for MIC 1/2 and INST 1/2 L/R. */
  eq: Record<InputEqSection, TagMap>;
  output: TagMap;
  routing: TagMap;
  /** OUTPUT EQ for MAIN / SUB 1 / SUB 2 L/R. */
  outputEq: Record<OutputEqSection, TagMap>;
  masterFx: TagMap;
  mixer: TagMap;
  ifxSetup: TagMap;
  /** Bank A–D under `<ifx>` (SW, MODE, FX TARGET). */
  ifxBanks: TagMap[];
  /** 4 banks × 4 slots (AA–AD … DA–DD). */
  ifxSlots: TagMap[][];
  /** Per-type param blocks under `<ifx>` (e.g. AA_PREAMP, AA_PHASER_SEQ). */
  ifxBlocks: Record<string, TagMap>;
  tfxSetup: TagMap;
  tfxBanks: TagMap[];
  tfxSlots: TagMap[][];
  /** Per-type param blocks under `<tfx>` (e.g. AA_BEAT_REPEAT, AA_PREAMP). */
  tfxBlocks: Record<string, TagMap>;
  raw: string;
}

export interface SystemModel {
  side: "1" | "2";
  count: string;
  sections: Record<string, TagMap>;
  raw: string;
}

const LETTER_TAGS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function readTags(xml: string, from: number, to: number): TagMap {
  const out: TagMap = {};
  for (const tag of LETTER_TAGS) {
    const v = getTagContent(xml, tag, from, to);
    if (v !== null) out[tag] = v;
  }
  return out;
}

const FX_BLOCK_TAG_SET = new Set<string>(FX_BLOCK_TAGS);

/** FX type blocks may include Step Slicer tags 0–9 and #. One pass — do not scan the rest of the file. */
function readFxBlockTags(xml: string, from: number, to: number): TagMap {
  const out: TagMap = {};
  let i = from;
  while (i < to) {
    const open = xml.indexOf("<", i);
    if (open < 0 || open >= to) break;
    if (xml[open + 1] === "/") {
      i = open + 2;
      continue;
    }
    const gt = xml.indexOf(">", open);
    if (gt < 0 || gt >= to) break;
    const name = xml.slice(open + 1, gt);
    if (FX_BLOCK_TAG_SET.has(name)) {
      const close = `</${name}>`;
      const end = xml.indexOf(close, gt + 1);
      if (end >= 0 && end < to) {
        out[name] = xml.slice(gt + 1, end);
        i = end + close.length;
        continue;
      }
    }
    i = gt + 1;
  }
  return out;
}

const FX_BLOCK_NAME_RE = /^[A-D][A-D]_[A-Z0-9_]+$/;

function parseFxBlocks(xml: string, from: number, to: number): Record<string, TagMap> {
  const blocks: Record<string, TagMap> = {};
  let i = from;
  while (i < to) {
    const open = xml.indexOf("<", i);
    if (open < 0 || open >= to) break;
    if (xml[open + 1] === "/") {
      i = open + 2;
      continue;
    }
    const gt = xml.indexOf(">", open);
    if (gt < 0 || gt >= to) break;
    let nameEnd = open + 1;
    while (nameEnd < gt && /[A-Za-z0-9_]/.test(xml[nameEnd]!)) nameEnd++;
    const name = xml.slice(open + 1, nameEnd);
    if (!FX_BLOCK_NAME_RE.test(name) || !isNamedOpenTag(xml, name, open)) {
      i = gt + 1;
      continue;
    }
    const close = `</${name}>`;
    const end = xml.indexOf(close, gt + 1);
    if (end < 0 || end >= to) break;
    blocks[name] = readFxBlockTags(xml, gt + 1, end);
    i = end + close.length;
  }
  return blocks;
}

const EMPTY_FX_BANKS: TagMap[] = [{}, {}, {}, {}];
const EMPTY_FX_SLOTS: TagMap[][] = [
  [{}, {}, {}, {}],
  [{}, {}, {}, {}],
  [{}, {}, {}, {}],
  [{}, {}, {}, {}],
];

function isNamedOpenTag(xml: string, name: string, at: number): boolean {
  if (!xml.startsWith(`<${name}`, at)) return false;
  const next = xml[at + name.length + 1];
  return next === ">" || next === " " || next === "\t" || next === "\r" || next === "\n";
}

function findNamedOpen(xml: string, name: string, from: number, to: number): number {
  const open = `<${name}`;
  let i = from;
  while (i < to) {
    const at = xml.indexOf(open, i);
    if (at < 0 || at >= to) return -1;
    if (isNamedOpenTag(xml, name, at)) return at;
    i = at + open.length;
  }
  return -1;
}

function matchingClose(xml: string, name: string, openAt: number, to: number): number {
  const close = `</${name}>`;
  let depth = 1;
  let i = xml.indexOf(">", openAt) + 1;
  while (i < to && depth > 0) {
    const nextOpen = findNamedOpen(xml, name, i, to);
    const nextClose = xml.indexOf(close, i);
    if (nextClose < 0 || nextClose >= to) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      i = xml.indexOf(">", nextOpen) + 1;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      i = nextClose + close.length;
    }
  }
  return -1;
}

/** Bank `<A>`–`<D>` under ifx/tfx, skipping letter tags such as SETUP's `<A>`. */
function findFxBankSection(
  xml: string,
  name: string,
  from: number,
  to: number,
): [number, number] | null {
  const close = `</${name}>`;
  let i = from;
  while (i < to) {
    const at = findNamedOpen(xml, name, i, to);
    if (at < 0) return null;
    const end = matchingClose(xml, name, at, to);
    if (end < 0) return null;
    const gt = xml.indexOf(">", at);
    const inner = xml.slice(gt + 1, end);
    if (inner.includes("<A>") && inner.includes("<B>")) {
      return [at, end + close.length];
    }
    i = end + close.length;
  }
  return null;
}

function parseFxFamily(
  xml: string,
  kind: "ifx" | "tfx",
): { setup: TagMap; banks: TagMap[]; slots: TagMap[][]; blocks: Record<string, TagMap> } {
  const range = findSection(xml, kind);
  if (!range) {
    return {
      setup: {},
      banks: EMPTY_FX_BANKS.map((b) => ({ ...b })),
      slots: EMPTY_FX_SLOTS.map((row) => row.map((s) => ({ ...s }))),
      blocks: {},
    };
  }
  const setupSec = findSection(xml, "SETUP", range[0], range[1]);
  const setup = setupSec ? readTags(xml, setupSec[0], setupSec[1]) : {};
  const banks: TagMap[] = [];
  const slots: TagMap[][] = [];
  for (let b = 0; b < FX_BANKS.length; b++) {
    const bankSec = findFxBankSection(xml, FX_BANKS[b], range[0], range[1]);
    if (bankSec) {
      const innerFrom = xml.indexOf(">", bankSec[0]) + 1;
      banks.push(readTags(xml, innerFrom, bankSec[1]));
    } else {
      banks.push({});
    }
    const row: TagMap[] = [];
    for (let s = 0; s < FX_BANKS.length; s++) {
      const name = fxSlotSection(b, s);
      const sec = findSection(xml, name, range[0], range[1]);
      row.push(sec ? readTags(xml, sec[0], sec[1]) : {});
    }
    slots.push(row);
  }
  const blocks = parseFxBlocks(xml, range[0], range[1]);
  return { setup, banks, slots, blocks };
}

export function decodeName(xml: string, memRange: [number, number]): string {
  const nameSec = findSection(xml, "NAME", memRange[0], memRange[1]);
  if (!nameSec) return "";
  const chars: string[] = [];
  for (const tag of "ABCDEFGHIJKL".split("")) {
    const val = getTagContent(xml, tag, nameSec[0], nameSec[1]);
    if (val === null) continue;
    const code = parseInt(val, 10);
    if (code >= 32 && code <= 126) chars.push(String.fromCharCode(code));
  }
  return chars.join("").trimEnd();
}

export function encodeNameChars(name: string): TagMap {
  const padded = name.slice(0, 12).padEnd(12, " ");
  const out: TagMap = {};
  "ABCDEFGHIJKL".split("").forEach((tag, i) => {
    out[tag] = String(padded.charCodeAt(i));
  });
  return out;
}

export function parseMemory(xml: string, slot: number): MemoryModel {
  const mem = findSection(xml, "mem") ?? ([0, xml.length] as [number, number]);
  const tracks: TagMap[] = [];
  for (let i = 1; i <= 6; i++) {
    const sec = findSection(xml, `TRACK${i}`, mem[0], mem[1]);
    tracks.push(sec ? readTags(xml, sec[0], sec[1]) : {});
  }
  const section = (name: string): TagMap => {
    const sec = findSection(xml, name, mem[0], mem[1]);
    return sec ? readTags(xml, sec[0], sec[1]) : {};
  };
  const assigns: TagMap[] = [];
  for (let i = 1; i <= 16; i++) {
    const sec = findSection(xml, `ASSIGN${i}`, mem[0], mem[1]);
    assigns.push(sec ? readTags(xml, sec[0], sec[1]) : {});
  }
  const ifx = parseFxFamily(xml, "ifx");
  const tfx = parseFxFamily(xml, "tfx");

  const master = section("MASTER");
  const ctlPedals: TagMap[][] = [];
  for (let mode = 1; mode <= 3; mode++) {
    const row: TagMap[] = [];
    for (let pedal = 1; pedal <= 9; pedal++) {
      row.push(section(`ICTL${mode}_PEDAL${pedal}`));
    }
    ctlPedals.push(row);
  }
  const ectlCtl: TagMap[] = [];
  for (let n = 1; n <= 4; n++) ectlCtl.push(section(`ECTL_CTL${n}`));
  const ectlExp: TagMap[] = [];
  for (let n = 1; n <= 2; n++) ectlExp.push(section(`ECTL_EXP${n}`));
  return {
    slot,
    name: decodeName(xml, mem),
    count: extractCount(xml),
    tracks,
    master,
    rec: section("REC"),
    play: section("PLAY"),
    rhythm: section("RHYTHM"),
    assigns,
    ctlPedals,
    ectlCtl,
    ectlExp,
    input: section("INPUT"),
    eq: Object.fromEntries(INPUT_EQ_SECTIONS.map((name) => [name, section(name)])) as Record<
      InputEqSection,
      TagMap
    >,
    output: section("OUTPUT"),
    routing: section("ROUTING"),
    outputEq: Object.fromEntries(OUTPUT_EQ_SECTIONS.map((name) => [name, section(name)])) as Record<
      OutputEqSection,
      TagMap
    >,
    masterFx: section("MASTER_FX"),
    mixer: section("MIXER"),
    ifxSetup: ifx.setup,
    ifxBanks: ifx.banks,
    ifxSlots: ifx.slots,
    ifxBlocks: ifx.blocks,
    tfxSetup: tfx.setup,
    tfxBanks: tfx.banks,
    tfxSlots: tfx.slots,
    tfxBlocks: tfx.blocks,
    raw: xml,
  };
}

export function memoryTempo(model: MemoryModel): number | undefined {
  const a = model.master.A;
  if (a === undefined) return undefined;
  return parseInt(a, 10) / 10;
}

function summarizeXml(xml: string): { name: string; count: string; tempo?: number } {
  const count = extractCount(xml);
  const mem = findSection(xml, "mem") ?? ([0, xml.length] as [number, number]);
  const master = findSection(xml, "MASTER", mem[0], mem[1]);
  const raw = master ? getTagContent(xml, "A", master[0], master[1]) : null;
  const tempo = raw != null ? parseInt(raw, 10) / 10 : undefined;
  return {
    name: decodeName(xml, mem),
    count,
    tempo: tempo != null && Number.isFinite(tempo) ? tempo : undefined,
  };
}

export function summarizePair(
  slot: number,
  xmlA: string,
  xmlB: string,
): MemorySummary {
  const a = summarizeXml(xmlA);
  const b = summarizeXml(xmlB);
  const active = activeSide(a.count, b.count);
  const model = active === "b" ? b : a;
  return {
    slot,
    name: model.name,
    countA: a.count,
    countB: b.count,
    active,
    tempo: model.tempo,
  };
}

export function parseSystem(xml: string, side: "1" | "2"): SystemModel {
  const sections: Record<string, TagMap> = {};
  const names = [
    "SETUP",
    "COLOR",
    "USB",
    "MIDI",
    "PREF",
    "INPUT",
    "OUTPUT",
    "ROUTING",
    "MIXER",
    "MASTER_FX",
    "FIXED_VALUE",
  ];
  for (const name of names) {
    const sec = findSection(xml, name);
    if (sec) sections[name] = readTags(xml, sec[0], sec[1]);
  }
  for (const eq of [
    "EQ_MIC1",
    "EQ_MIC2",
    "EQ_INST1L",
    "EQ_INST1R",
    "EQ_INST2L",
    "EQ_INST2R",
    "EQ_MAINOUTL",
    "EQ_MAINOUTR",
    "EQ_SUBOUT1L",
    "EQ_SUBOUT1R",
    "EQ_SUBOUT2L",
    "EQ_SUBOUT2R",
  ]) {
    const sec = findSection(xml, eq);
    if (sec) sections[eq] = readTags(xml, sec[0], sec[1]);
  }
  return { side, count: extractCount(xml), sections, raw: xml };
}

/** SYSTEM1/2 pair: higher `<count>` wins (same rule as memory A/B). */
export function pickActiveSystem(
  xml1: string | undefined,
  xml2: string | undefined,
): { side: "1" | "2"; xml: string } | null {
  if (xml1 && xml2) {
    const side = activeSide(extractCount(xml1), extractCount(xml2));
    return { side: side === "a" ? "1" : "2", xml: side === "a" ? xml1 : xml2 };
  }
  if (xml1) return { side: "1", xml: xml1 };
  if (xml2) return { side: "2", xml: xml2 };
  return null;
}

/**
 * System `.RC0` has the same INPUT/OUTPUT/MIXER/CTL sections as memory, but under `<sys>`
 * instead of `<mem>`. `parseMemory` already falls back to the whole document when `<mem>` is absent.
 */
export function systemAsMemoryModel(xml: string): MemoryModel {
  return parseMemory(xml, 0);
}

export function pickActiveXml(xmlA: string, xmlB: string): { side: "a" | "b"; xml: string } {
  const side = activeSide(extractCount(xmlA), extractCount(xmlB));
  return { side, xml: side === "b" ? xmlB : xmlA };
}

export function inactiveSide(side: "a" | "b"): "a" | "b" {
  return side === "a" ? "b" : "a";
}

/**
 * Each memory is a ping-pong A/B pair. Saving only one side leaves the other
 * with the previous Rhythm Kit, and the pedal may reload that stale file.
 * Mirror the assembled XML onto both files so either side has the new kit.
 */
export function memoryFilesAfterSave(savedXml: string): { xmlA: string; xmlB: string } {
  return { xmlA: savedXml, xmlB: savedXml };
}

export { extractCount, parseHexCount, activeSide };
