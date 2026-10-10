export type LicensePlan = "full" | "preview";

export const PREVIEW_LIST_SAVE =
  "A preview key can play songs and look through the editor. It cannot save setlists or rhythm lists.";

export const PREVIEW_PEDAL_SAVE =
  "A preview key can save memories while editing offline. Saving is turned off while the RC-600 is connected.";

export const PREVIEW_BANNER =
  "Preview key: you can play and edit. Setlists and rhythm lists are not saved. Memories save only while the RC-600 is not connected.";

const DAY_MS = 86_400_000;

/** Whole days left on a key with an end date, counting today; null when the key never ends. */
export function licenseDaysLeft(expiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

/** Top-bar label for a key with a time limit or a preview plan; null for a full key that never ends. */
export function licenseBadgeText(
  plan: string | null | undefined,
  expiresAt: string | null | undefined,
  now = Date.now(),
): string | null {
  const days = licenseDaysLeft(expiresAt, now);
  const kind = isPreviewPlan(plan) ? "Preview" : days != null ? "Trial" : null;
  if (!kind) return null;
  if (days == null) return kind;
  if (days <= 1) return `${kind} · ends today`;
  return `${kind} · ${days} days left`;
}

export function isPreviewPlan(plan: string | null | undefined): boolean {
  return plan === "preview";
}

/** Setlists, rhythm libraries and rhythm slot lists. */
export function previewBlocksListSave(plan: string | null | undefined): boolean {
  return isPreviewPlan(plan);
}

/** Memory and system writes that go to the open RC-600 folder. */
export function previewBlocksPedalSave(plan: string | null | undefined, pedalConnected: boolean): boolean {
  return isPreviewPlan(plan) && pedalConnected;
}
