export type LicensePlan = "full" | "preview";

export const PREVIEW_LIST_SAVE =
  "A preview key can play songs and look through the editor. It cannot save setlists or rhythm lists.";

export const PREVIEW_RHYTHM_SAVE =
  "A preview key saves RHYTHM.RC0 with one rhythm only. It replaces every user rhythm on the RC-600.";

export const PREVIEW_PEDAL_SAVE =
  "A preview key can save memories while editing offline. Saving is turned off while the RC-600 is connected.";

export const PREVIEW_BANNER =
  "Preview key: you can play and edit. Setlists and rhythm lists are not saved; RHYTHM.RC0 holds one rhythm. Memories save only while the RC-600 is not connected.";

const DAY_MS = 86_400_000;

/** Whole days left on a key with an end date, counting today; null when the key never ends. */
export function licenseDaysLeft(expiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

/** Top-bar label for a preview key or a trial key (30 days or less); null for a regular license, dated or not. */
export function licenseBadgeText(
  plan: string | null | undefined,
  expiresAt: string | null | undefined,
  trial: boolean | null | undefined,
  now = Date.now(),
): string | null {
  const days = licenseDaysLeft(expiresAt, now);
  const kind = isPreviewPlan(plan) ? "Preview" : trial ? "Trial" : null;
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
