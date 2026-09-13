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

export function dirtySlotNumbers(drafts: DraftMap): number[] {
  const out: number[] = [];
  for (const [s, slotOps] of drafts) {
    if (slotOps.length > 0) out.push(s);
  }
  return out.sort((a, b) => a - b);
}
