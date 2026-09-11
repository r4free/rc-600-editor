/**
 * RC0 XML writer — server-only. Do not import from the web bundle.
 */
import { encodeNameChars, parseMemory, type TagMap } from "./memory.js";
import type { AssembleRequest, AssembleResponse, PatchOp } from "./ops.js";
import {
  findSection,
  setTagContent,
  incrementCount,
} from "./xml-ops.js";

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

export function assemble(req: AssembleRequest): AssembleResponse {
  if (req.kind === "copy") {
    if (req.mode === "all") {
      return { xml: prepareSaveXml(req.sourceXml) };
    }
    const source = parseMemory(req.sourceXml, 0);
    let patched = req.targetXml;
    for (let i = 1; i <= 16; i++) {
      patched = patchAssign(patched, i, source.assigns[i - 1] ?? {});
    }
    return { xml: prepareSaveXml(patched) };
  }

  let xml = req.xml;
  for (const op of req.ops) {
    xml = applyPatchOp(xml, op);
  }
  return { xml: prepareSaveXml(xml) };
}
