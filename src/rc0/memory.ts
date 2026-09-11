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
  input: TagMap;
  output: TagMap;
  routing: TagMap;
  mixer: TagMap;
  ifxSetup: TagMap;
  tfxSetup: TagMap;
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
  const ifx = findSection(xml, "ifx");
  const tfx = findSection(xml, "tfx");
  const ifxSetup = ifx
    ? (() => {
        const s = findSection(xml, "SETUP", ifx[0], ifx[1]);
        return s ? readTags(xml, s[0], s[1]) : {};
      })()
    : {};
  const tfxSetup = tfx
    ? (() => {
        const s = findSection(xml, "SETUP", tfx[0], tfx[1]);
        return s ? readTags(xml, s[0], s[1]) : {};
      })()
    : {};

  const master = section("MASTER");
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
    input: section("INPUT"),
    output: section("OUTPUT"),
    routing: section("ROUTING"),
    mixer: section("MIXER"),
    ifxSetup,
    tfxSetup,
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
