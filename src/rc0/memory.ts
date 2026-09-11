import {
  FX_BANKS,
  INPUT_EQ_SECTIONS,
  OUTPUT_EQ_SECTIONS,
  fxSlotSection,
  type InputEqSection,
  type OutputEqSection,
} from "../catalog/params.js";
import {
  extractCount,
  findSection,
  getTagContent,
  setTagContent,
  activeSide,
  incrementCount,
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
  tfxSetup: TagMap;
  tfxBanks: TagMap[];
  tfxSlots: TagMap[][];
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
): { setup: TagMap; banks: TagMap[]; slots: TagMap[][] } {
  const range = findSection(xml, kind);
  if (!range) {
    return {
      setup: {},
      banks: EMPTY_FX_BANKS.map((b) => ({ ...b })),
      slots: EMPTY_FX_SLOTS.map((row) => row.map((s) => ({ ...s }))),
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
  return { setup, banks, slots };
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
    tfxSetup: tfx.setup,
    tfxBanks: tfx.banks,
    tfxSlots: tfx.slots,
    raw: xml,
  };
}

export function memoryTempo(model: MemoryModel): number | undefined {
  const a = model.master.A;
  if (a === undefined) return undefined;
  return parseInt(a, 10) / 10;
}

export function summarizePair(
  slot: number,
  xmlA: string,
  xmlB: string,
): MemorySummary {
  const a = parseMemory(xmlA, slot);
  const b = parseMemory(xmlB, slot);
  const active = activeSide(a.count, b.count);
  const model = active === "b" ? b : a;
  return {
    slot,
    name: model.name,
    countA: a.count,
    countB: b.count,
    active,
    tempo: memoryTempo(model),
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

/** Patch a top-level section in SYSTEM*.RC0 (no `<mem>` wrapper). */
export function patchSysSection(xml: string, section: string, tags: TagMap): string {
  return patchSectionTags(xml, section, tags);
}

/** Patch tags inside a named section under mem (or root for system). */
export function patchSectionTags(
  xml: string,
  sectionName: string,
  tags: TagMap,
  parentFrom = 0,
  parentTo = xml.length,
): string {
  const sec = findSection(xml, sectionName, parentFrom, parentTo);
  if (!sec) return xml;
  let next = xml;
  // After each replace, re-find section because offsets shift.
  for (const [tag, value] of Object.entries(tags)) {
    const again = findSection(next, sectionName, parentFrom, next.length);
    if (!again) break;
    const patched = setTagContent(next, tag, value, again[0], again[1]);
    if (patched) next = patched;
  }
  return next;
}

export function patchMemoryName(xml: string, name: string): string {
  const mem = findSection(xml, "mem");
  if (!mem) return xml;
  return patchSectionTags(xml, "NAME", encodeNameChars(name), mem[0], mem[1]);
}

export function patchTrack(
  xml: string,
  trackNumber: number,
  tags: TagMap,
): string {
  const mem = findSection(xml, "mem");
  if (!mem) return xml;
  return patchSectionTags(xml, `TRACK${trackNumber}`, tags, mem[0], mem[1]);
}

export function patchAssign(xml: string, assignNumber: number, tags: TagMap): string {
  const mem = findSection(xml, "mem");
  if (!mem) return xml;
  return patchSectionTags(xml, `ASSIGN${assignNumber}`, tags, mem[0], mem[1]);
}

export function patchMemSection(xml: string, section: string, tags: TagMap): string {
  const mem = findSection(xml, "mem");
  if (!mem) return xml;
  return patchSectionTags(xml, section, tags, mem[0], mem[1]);
}

/** Patch a named section inside `<ifx>` (SETUP, bank A–D, or slot AA–DD). */
export function patchIfxSection(xml: string, section: string, tags: TagMap): string {
  return patchFxFamilySection(xml, "ifx", section, tags);
}

/** Patch a named section inside `<tfx>` (SETUP, bank A–D, or slot AA–DD). */
export function patchTfxSection(xml: string, section: string, tags: TagMap): string {
  return patchFxFamilySection(xml, "tfx", section, tags);
}

function patchFxFamilySection(
  xml: string,
  kind: "ifx" | "tfx",
  section: string,
  tags: TagMap,
): string {
  let next = xml;
  for (const [tag, value] of Object.entries(tags)) {
    const parent = findSection(next, kind);
    if (!parent) break;
    const sec =
      section.length === 1
        ? findFxBankSection(next, section, parent[0], parent[1])
        : findSection(next, section, parent[0], parent[1]);
    if (!sec) break;
    const from = section.length === 1 ? next.indexOf(">", sec[0]) + 1 : sec[0];
    const patched = setTagContent(next, tag, value, from, sec[1]);
    if (patched) next = patched;
  }
  return next;
}

export function prepareSaveXml(xml: string): string {
  return incrementCount(xml);
}

export function pickActiveXml(xmlA: string, xmlB: string): { side: "a" | "b"; xml: string } {
  const side = activeSide(extractCount(xmlA), extractCount(xmlB));
  return { side, xml: side === "b" ? xmlB : xmlA };
}

export function inactiveSide(side: "a" | "b"): "a" | "b" {
  return side === "a" ? "b" : "a";
}

export { extractCount, parseHexCount, activeSide, incrementCount };
