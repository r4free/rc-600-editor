/** Client Full plan key + device seat helpers. */

export const PLAN_KEY_STORAGE = "rc600.fullPlanKey";
export const DEVICE_ID_STORAGE = "rc600.deviceId";
export const PLAN_KEY_HEADER = "X-RC600-Plan-Key";
export const DEVICE_ID_HEADER = "X-RC600-Device-Id";

export type FullFeatureId = "setlists";

export interface LicenseDeviceInfo {
  id: string;
  label: string;
  lastSeenAt: string;
  current: boolean;
}

export interface ClientEntitlements {
  localDev: boolean;
  fullPlan: boolean;
  unlocked: boolean;
  features: Record<FullFeatureId, boolean>;
  keyValid: boolean;
  deviceBound: boolean;
  deviceLimitReached: boolean;
  maxDevices: number;
  devices: LicenseDeviceInfo[];
}

export const LOCKED_ENTITLEMENTS: ClientEntitlements = {
  localDev: false,
  fullPlan: false,
  unlocked: false,
  features: { setlists: false },
  keyValid: false,
  deviceBound: false,
  deviceLimitReached: false,
  maxDevices: 3,
  devices: [],
};

/** Vite `npm run ui` — Setlists stay on without waiting for the API. */
export const LOCAL_UNLOCKED_ENTITLEMENTS: ClientEntitlements = {
  ...LOCKED_ENTITLEMENTS,
  localDev: true,
  unlocked: true,
  features: { setlists: true },
};

export function isLocalEditorUi(): boolean {
  try {
    const env = (import.meta as { env?: { DEV?: boolean } }).env;
    return env?.DEV === true;
  } catch {
    return false;
  }
}

export function featureUnlocked(ent: ClientEntitlements, feature: FullFeatureId): boolean {
  if (isLocalEditorUi() || ent.localDev || ent.unlocked) return true;
  return ent.features[feature] === true;
}

export function initialEntitlements(): ClientEntitlements {
  return isLocalEditorUi() ? LOCAL_UNLOCKED_ENTITLEMENTS : LOCKED_ENTITLEMENTS;
}

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function newDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function readStoredPlanKey(store: Storage | null = storage()): string {
  if (!store) return "";
  try {
    return store.getItem(PLAN_KEY_STORAGE)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeStoredPlanKey(key: string, store: Storage | null = storage()): void {
  if (!store) return;
  try {
    const trimmed = key.trim();
    if (!trimmed) store.removeItem(PLAN_KEY_STORAGE);
    else store.setItem(PLAN_KEY_STORAGE, trimmed);
  } catch {
    /* quota / private mode */
  }
}

/** Stable browser device id (one seat). Created once per profile. */
export function ensureDeviceId(store: Storage | null = storage()): string {
  if (!store) return newDeviceId();
  try {
    const existing = store.getItem(DEVICE_ID_STORAGE)?.trim() ?? "";
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;
    const id = newDeviceId();
    store.setItem(DEVICE_ID_STORAGE, id);
    return id;
  } catch {
    return newDeviceId();
  }
}

export function readStoredDeviceId(store: Storage | null = storage()): string {
  if (!store) return "";
  try {
    return store.getItem(DEVICE_ID_STORAGE)?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Headers for plan key + device id (sent on every API call). */
export function planKeyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const key = readStoredPlanKey();
  if (key) headers[PLAN_KEY_HEADER] = key;
  const deviceId = ensureDeviceId();
  if (deviceId) headers[DEVICE_ID_HEADER] = deviceId;
  return headers;
}

function normalizeDevice(raw: unknown): LicenseDeviceInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  return {
    id: o.id.trim(),
    label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : "Unknown",
    lastSeenAt: typeof o.lastSeenAt === "string" ? o.lastSeenAt : "",
    current: o.current === true,
  };
}

export function normalizeEntitlements(raw: unknown): ClientEntitlements {
  if (!raw || typeof raw !== "object") return { ...LOCKED_ENTITLEMENTS };
  const o = raw as Record<string, unknown>;
  const featuresRaw = (o.features && typeof o.features === "object" ? o.features : {}) as Record<
    string,
    unknown
  >;
  const unlocked = Boolean(o.unlocked);
  const devicesRaw = Array.isArray(o.devices) ? o.devices : [];
  const devices = devicesRaw.map(normalizeDevice).filter((d): d is LicenseDeviceInfo => d !== null);
  return {
    localDev: Boolean(o.localDev),
    fullPlan: Boolean(o.fullPlan),
    unlocked,
    features: {
      setlists: featuresRaw.setlists === true || unlocked,
    },
    keyValid: Boolean(o.keyValid),
    deviceBound: Boolean(o.deviceBound),
    deviceLimitReached: Boolean(o.deviceLimitReached),
    maxDevices: typeof o.maxDevices === "number" && o.maxDevices > 0 ? o.maxDevices : 3,
    devices,
  };
}
