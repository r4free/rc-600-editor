import { useCallback, useState } from "react";

export const UI_TABS_KEY = "rc600.ui.tabs";

type UiTabValue = string | number;

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function loadUiTabs(): Record<string, UiTabValue> {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(UI_TABS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, UiTabValue> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
      else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveUiTab(key: string, value: UiTabValue): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(UI_TABS_KEY, JSON.stringify({ ...loadUiTabs(), [key]: value }));
  } catch {
    /* quota / private mode */
  }
}

export function readUiTab<T extends UiTabValue>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): T {
  const stored = loadUiTabs()[key];
  return (allowed as readonly unknown[]).includes(stored) ? (stored as T) : fallback;
}

export function usePersistedTab<T extends UiTabValue>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readUiTab(key, fallback, allowed));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      saveUiTab(key, next);
    },
    [key],
  );
  return [value, set];
}
