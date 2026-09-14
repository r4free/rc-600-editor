import { encodeNameChars, parseMemory, type MemoryModel, type TagMap } from "./memory.js";
import {
  MEMORY_COPY_INPUT_DYNAMICS_TAGS,
  MEMORY_COPY_INPUT_SETUP_TAGS,
  MEMORY_COPY_MIXER_INPUT_TAGS,
  MEMORY_COPY_MIXER_OUTPUT_TAGS,
  parseMemoryCopySelection,
  pickTags,
  type MemoryCopySelection,
} from "./memoryCopy.js";
import type { AssembleRequest, AssembleResponse, PatchOp } from "./ops.js";
import {
  findSection,
  setTagContent,
  incrementCount,
} from "./xml-ops.js";

const INPUT_EQ_SECTIONS = [
  "EQ_MIC1",
  "EQ_MIC2",
  "EQ_INST1L",
  "EQ_INST1R",
  "EQ_INST2L",
  "EQ_INST2R",
] as const;

const OUTPUT_EQ_SECTIONS = [
  "EQ_MAINOUTL",
  "EQ_MAINOUTR",
  "EQ_SUBOUT1L",
  "EQ_SUBOUT1R",
  "EQ_SUBOUT2L",
  "EQ_SUBOUT2R",
] as const;
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

export function patchTrack(xml: string, trackNumber: number, tags: TagMap): string {
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

export function applyPatchOp(xml: string, op: PatchOp): string {
  switch (op.type) {
    case "track":
      return patchTrack(xml, op.track, op.tags);
    case "section":
      if (op.scope === "sys") return patchSysSection(xml, op.section, op.tags);
      return patchMemSection(xml, op.section, op.tags);
    case "assign":
      return patchAssign(xml, op.assign, op.tags);
    case "name":
      return patchMemoryName(xml, op.name);
    case "ifx":
      return patchIfxSection(xml, op.section, op.tags);
    case "tfx":
      return patchTfxSection(xml, op.section, op.tags);
    default:
      return xml;
  }
}

function selectionFromCopyRequest(req: Extract<AssembleRequest, { kind: "copy" }>): MemoryCopySelection | "all" {
  if (req.selection) {
    const parsed = parseMemoryCopySelection(req.selection);
    if (parsed) return parsed;
  }
  if (req.mode === "all") return "all";
  const sel = parseMemoryCopySelection({})!;
  if (req.mode === "assigns") {
    sel.assigns = Array.from({ length: 16 }, (_, i) => i + 1);
    return sel;
  }
  if (req.mode === "inputFx") {
    sel.ifxBanks = [true, true, true, true];
    sel.ifxSlots = [
      [true, true, true, true],
      [true, true, true, true],
      [true, true, true, true],
      [true, true, true, true],
    ];
    return sel;
  }
  return sel;
}

function applyMemoryCopySelection(
  source: MemoryModel,
  targetXml: string,
  sel: MemoryCopySelection,
): string {
  let patched = targetXml;

  for (const t of sel.tracks) {
    patched = patchTrack(patched, t, source.tracks[t - 1] ?? {});
  }
  if (sel.rec) patched = patchMemSection(patched, "REC", source.rec);
  if (sel.play) patched = patchMemSection(patched, "PLAY", source.play);
  if (sel.rhythm) patched = patchMemSection(patched, "RHYTHM", source.rhythm);

  const inputTags: TagMap = {};
  if (sel.inputSetup) Object.assign(inputTags, pickTags(source.input, MEMORY_COPY_INPUT_SETUP_TAGS));
  if (sel.inputDynamics) {
    Object.assign(inputTags, pickTags(source.input, MEMORY_COPY_INPUT_DYNAMICS_TAGS));
  }
  if (Object.keys(inputTags).length) patched = patchMemSection(patched, "INPUT", inputTags);
  if (sel.inputEq) {
    for (const sec of INPUT_EQ_SECTIONS) {
      patched = patchMemSection(patched, sec, source.eq[sec] ?? {});
    }
  }

  if (sel.outputSetup) patched = patchMemSection(patched, "OUTPUT", source.output);
  if (sel.routing) patched = patchMemSection(patched, "ROUTING", source.routing);
  if (sel.outputEq) {
    for (const sec of OUTPUT_EQ_SECTIONS) {
      patched = patchMemSection(patched, sec, source.outputEq[sec] ?? {});
    }
  }
  if (sel.masterFx) patched = patchMemSection(patched, "MASTER_FX", source.masterFx);

  const mixerTags: TagMap = {};
  if (sel.mixerInput) Object.assign(mixerTags, pickTags(source.mixer, MEMORY_COPY_MIXER_INPUT_TAGS));
  if (sel.mixerOutput) Object.assign(mixerTags, pickTags(source.mixer, MEMORY_COPY_MIXER_OUTPUT_TAGS));
  if (Object.keys(mixerTags).length) patched = patchMemSection(patched, "MIXER", mixerTags);

  for (const a of sel.assigns) {
    patched = patchAssign(patched, a, source.assigns[a - 1] ?? {});
  }

  if (sel.ifxSetup) patched = patchIfxSection(patched, "SETUP", source.ifxSetup);
  for (let b = 0; b < 4; b++) {
    const bank = String.fromCharCode(65 + b);
    if (sel.ifxBanks[b]) patched = patchIfxSection(patched, bank, source.ifxBanks[b] ?? {});
    for (let s = 0; s < 4; s++) {
      if (sel.ifxSlots[b]?.[s]) {
        patched = patchIfxSection(
          patched,
          `${bank}${String.fromCharCode(65 + s)}`,
          source.ifxSlots[b]?.[s] ?? {},
        );
      }
    }
  }

  if (sel.tfxSetup) patched = patchTfxSection(patched, "SETUP", source.tfxSetup);
  for (let b = 0; b < 4; b++) {
    const bank = String.fromCharCode(65 + b);
    if (sel.tfxBanks[b]) patched = patchTfxSection(patched, bank, source.tfxBanks[b] ?? {});
    for (let s = 0; s < 4; s++) {
      if (sel.tfxSlots[b]?.[s]) {
        patched = patchTfxSection(
          patched,
          `${bank}${String.fromCharCode(65 + s)}`,
          source.tfxSlots[b]?.[s] ?? {},
        );
      }
    }
  }

  for (let mode = 0; mode < 3; mode++) {
    for (let pedal = 0; pedal < 9; pedal++) {
      if (sel.ctlModes[mode]?.[pedal]) {
        patched = patchMemSection(
          patched,
          `ICTL${mode + 1}_PEDAL${pedal + 1}`,
          source.ctlPedals[mode]?.[pedal] ?? {},
        );
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    if (sel.ectlCtl[i]) {
      patched = patchMemSection(patched, `ECTL_CTL${i + 1}`, source.ectlCtl[i] ?? {});
    }
  }
  for (let i = 0; i < 2; i++) {
    if (sel.ectlExp[i]) {
      patched = patchMemSection(patched, `ECTL_EXP${i + 1}`, source.ectlExp[i] ?? {});
    }
  }

  return patched;
}

export function assemble(req: AssembleRequest): AssembleResponse {
  if (req.kind === "copy") {
    const resolved = selectionFromCopyRequest(req);
    if (resolved === "all" || (typeof resolved !== "string" && resolved.copyAll)) {
      return { xml: prepareSaveXml(req.sourceXml) };
    }
    const source = parseMemory(req.sourceXml, 0);
    const patched = applyMemoryCopySelection(source, req.targetXml, resolved);
    return { xml: prepareSaveXml(patched) };
  }

  let xml = req.xml;
  for (const op of req.ops) {
    xml = applyPatchOp(xml, op);
  }
  return { xml: prepareSaveXml(xml) };
}
