import type { PatchOp } from "@rc600/rc0/ops";
import { slotFileName, systemFileName } from "@rc600/files/roland";
import type { DraftMap } from "./memoryDrafts";

export const PROJECT_FORMAT = "rc600-editor-project";
export const PROJECT_VERSION = 1;
const MAX_SLOT = 99;

/** `xml` replaces the whole memory before `ops` (Mass Apply results); otherwise ops run on the loaded memory. */
export type ProjectMemory = { slot: number; name?: string; xml?: string; ops: PatchOp[] };

export type Rc600Project = {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  createdAt: string;
  source?: string;
  system?: { ops: PatchOp[] };
  memories: ProjectMemory[];
};

/** Edits already built into the loaded files this session (Save / Mass Apply), relative to the baseline. */
export type CommittedEdits = {
  memories: Map<number, { xml?: string; ops: PatchOp[] }>;
  system: PatchOp[];
};

export function emptyCommitted(): CommittedEdits {
  return { memories: new Map(), system: [] };
}

export function commitMemoryOps(c: CommittedEdits, slot: number, ops: PatchOp[]): CommittedEdits {
  if (ops.length === 0) return c;
  const memories = new Map(c.memories);
  const prev = memories.get(slot);
  memories.set(slot, { xml: prev?.xml, ops: [...(prev?.ops ?? []), ...ops] });
  return { ...c, memories };
}

export function commitMemoryXml(c: CommittedEdits, slot: number, xml: string): CommittedEdits {
  const memories = new Map(c.memories);
  memories.set(slot, { xml, ops: [] });
  return { ...c, memories };
}

export function commitSystemOps(c: CommittedEdits, ops: PatchOp[]): CommittedEdits {
  if (ops.length === 0) return c;
  return { ...c, system: [...c.system, ...ops] };
}

export function serializeProject(input: {
  committed: CommittedEdits;
  drafts: DraftMap;
  sysOps: PatchOp[];
  nameOf?: (slot: number) => string | undefined;
  source?: string;
  createdAt?: string;
}): Rc600Project {
  const slots = new Set<number>([...input.committed.memories.keys(), ...input.drafts.keys()]);
  const memories: ProjectMemory[] = [];
  for (const slot of [...slots].sort((a, b) => a - b)) {
    const done = input.committed.memories.get(slot);
    const ops = [...(done?.ops ?? []), ...(input.drafts.get(slot) ?? [])];
    if (!done?.xml && ops.length === 0) continue;
    const entry: ProjectMemory = { slot, ops };
    const name = input.nameOf?.(slot);
    if (name) entry.name = name;
    if (done?.xml) entry.xml = done.xml;
    memories.push(entry);
  }
  const sys = [...input.committed.system, ...input.sysOps];
  const project: Rc600Project = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    memories,
  };
  if (input.source) project.source = input.source;
  if (sys.length) project.system = { ops: sys };
  return project;
}

export function isProjectEmpty(p: Rc600Project): boolean {
  return p.memories.length === 0 && !p.system?.ops.length;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isTagMap(v: unknown): boolean {
  return isRecord(v) && Object.values(v).every((x) => typeof x === "string");
}

function isIntIn(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

export function isPatchOp(v: unknown): v is PatchOp {
  if (!isRecord(v)) return false;
  switch (v.type) {
    case "track":
      return isIntIn(v.track, 1, 6) && isTagMap(v.tags);
    case "section":
      return (
        typeof v.section === "string" &&
        isTagMap(v.tags) &&
        (v.scope === undefined || v.scope === "mem" || v.scope === "sys")
      );
    case "assign":
      return isIntIn(v.assign, 1, 99) && isTagMap(v.tags);
    case "name":
      return typeof v.name === "string";
    case "ifx":
    case "tfx":
      return typeof v.section === "string" && isTagMap(v.tags);
    default:
      return false;
  }
}

function parseOps(v: unknown, where: string): PatchOp[] {
  if (!Array.isArray(v)) throw new Error(`${where}: "ops" must be a list`);
  v.forEach((op, i) => {
    if (!isPatchOp(op)) throw new Error(`${where}: change #${i + 1} is not valid`);
  });
  return v as PatchOp[];
}

export function parseProject(text: string): Rc600Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!isRecord(raw) || raw.format !== PROJECT_FORMAT) {
    throw new Error("This is not an RC-600 edits file (made with Export edits).");
  }
  if (raw.version !== PROJECT_VERSION) {
    throw new Error(`Unsupported project version ${String(raw.version)} (expected ${PROJECT_VERSION}).`);
  }
  if (!Array.isArray(raw.memories)) throw new Error('Project is missing the "memories" list.');
  const seen = new Set<number>();
  const memories: ProjectMemory[] = raw.memories.map((m, i) => {
    if (!isRecord(m) || !isIntIn(m.slot, 1, MAX_SLOT)) {
      throw new Error(`Memory entry #${i + 1}: slot must be 1–${MAX_SLOT}.`);
    }
    if (seen.has(m.slot)) throw new Error(`Memory ${m.slot} appears more than once.`);
    seen.add(m.slot);
    const where = `Memory ${m.slot}`;
    if (m.xml !== undefined && (typeof m.xml !== "string" || !m.xml.includes("<mem"))) {
      throw new Error(`${where}: embedded memory data is not valid.`);
    }
    const entry: ProjectMemory = { slot: m.slot, ops: parseOps(m.ops, where) };
    if (typeof m.name === "string") entry.name = m.name;
    if (typeof m.xml === "string") entry.xml = m.xml;
    return entry;
  });
  const project: Rc600Project = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    memories: memories.sort((a, b) => a.slot - b.slot),
  };
  if (typeof raw.source === "string") project.source = raw.source;
  if (raw.system !== undefined) {
    if (!isRecord(raw.system)) throw new Error('"system" must be an object.');
    project.system = { ops: parseOps(raw.system.ops, "System") };
  }
  return project;
}

/** e.g. "Memory 1, 2, 3, 5 and System". */
export function describeProject(p: Rc600Project): string {
  const parts: string[] = [];
  if (p.memories.length) {
    parts.push(
      `Memor${p.memories.length === 1 ? "y" : "ies"} ${p.memories.map((m) => m.slot).join(", ")}`,
    );
  }
  if (p.system?.ops.length) parts.push("System");
  return parts.length ? parts.join(" and ") : "nothing";
}

export type ProjectState = {
  files: Map<string, string>;
  baseline: Map<string, string>;
  drafts: DraftMap;
  committed: CommittedEdits;
  sysOps: PatchOp[];
};

/**
 * Puts each project memory back into its own slot: the slot returns to the loaded baseline
 * (or the embedded memory), then the project changes become pending edits. Other slots are untouched.
 */
export function applyProject(project: Rc600Project, state: ProjectState): ProjectState {
  const files = new Map(state.files);
  const drafts = new Map(state.drafts);
  const memories = new Map(state.committed.memories);
  for (const m of project.memories) {
    const a = slotFileName(m.slot, "A");
    const b = slotFileName(m.slot, "B");
    if (m.xml) {
      files.set(a, m.xml);
      files.set(b, m.xml);
      memories.set(m.slot, { xml: m.xml, ops: [] });
    } else {
      for (const path of [a, b]) {
        const base = state.baseline.get(path);
        if (base !== undefined) files.set(path, base);
        else if (state.baseline.has(a) || state.baseline.has(b)) files.delete(path);
      }
      memories.delete(m.slot);
    }
    if (m.ops.length) drafts.set(m.slot, [...m.ops]);
    else drafts.delete(m.slot);
  }
  let system = state.committed.system;
  let sysOps = state.sysOps;
  if (project.system) {
    for (const side of ["1", "2"] as const) {
      const path = systemFileName(side);
      const base = state.baseline.get(path);
      if (base !== undefined) files.set(path, base);
    }
    system = [];
    sysOps = [...project.system.ops];
  }
  return {
    files,
    baseline: state.baseline,
    drafts,
    committed: { memories, system },
    sysOps,
  };
}
