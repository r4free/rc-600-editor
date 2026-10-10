import type { PatchOp } from "@rc600/rc0/ops";

export type DraftMap = Map<number, PatchOp[]>;

export function clearSlotDraft(drafts: DraftMap, s: number): DraftMap {
  if (!drafts.has(s)) return drafts;
  const next = new Map(drafts);
  next.delete(s);
  return next;
}

export function appendSlotDraft(drafts: DraftMap, s: number, ops: PatchOp[]): DraftMap {
  if (ops.length === 0) return drafts;
  const next = new Map(drafts);
  next.set(s, [...(next.get(s) ?? []), ...ops]);
  return next;
}

/** Ops appended after `saved` was taken; empty when nothing new was added. */
export function opsAfterSave(current: PatchOp[], saved: PatchOp[]): PatchOp[] {
  const isPrefix = current.length > saved.length && saved.every((op, i) => current[i] === op);
  return isPrefix ? current.slice(saved.length) : [];
}

/** Drops the ops that were just saved, keeping any appended to the slot while the save ran. */
export function removeSavedOps(drafts: DraftMap, s: number, saved: PatchOp[]): DraftMap {
  const current = drafts.get(s);
  if (!current) return drafts;
  const next = new Map(drafts);
  const rest = opsAfterSave(current, saved);
  if (rest.length) next.set(s, rest);
  else next.delete(s);
  return next;
}

export function dirtySlotNumbers(drafts: DraftMap): number[] {
  const out: number[] = [];
  for (const [s, slotOps] of drafts) {
    if (slotOps.length > 0) out.push(s);
  }
  return out.sort((a, b) => a - b);
}
