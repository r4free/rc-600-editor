/**
 * Full-plan / local-dev entitlements.
 * Paid features (Setlists) unlock when:
 * - running the editor in local development, or
 * - the request presents a valid access key from RC600_FULL_PLAN_KEYS
 *   and this browser is one of up to 3 bound devices for that key.
 */
import { timingSafeEqual } from "node:crypto";
import {
  DEVICE_ID_HEADER,
  MAX_DEVICES_PER_KEY,
  deviceIdFromHeader,
  ensureDeviceBound,
  labelFromUserAgent,
  listDevicesForKey,
  revokeDevice,
  type LicenseDevicePublic,
} from "./licenseSeats.js";

export const PLAN_KEY_HEADER = "x-rc600-plan-key";
export { DEVICE_ID_HEADER, MAX_DEVICES_PER_KEY };

export type FullFeatureId = "setlists";

export interface EntitlementsSnapshot {
  /** Editor is running outside hosted production (local `npm run api`). */
  localDev: boolean;
  /** Valid Full plan key + this device is bound (or localDev). */
  fullPlan: boolean;
  /** Effective unlock for gated features. */
  unlocked: boolean;
  features: Record<FullFeatureId, boolean>;
  /** Presented key is in RC600_FULL_PLAN_KEYS (ignores device binding). */
  keyValid?: boolean;
  /** This device is bound for the presented key. */
  deviceBound?: boolean;
  /** Key is valid but all 3 seats are taken by other devices. */
  deviceLimitReached?: boolean;
  maxDevices?: number;
  /** Seat list — only when the presented key is valid (no fishing). */
  devices?: LicenseDevicePublic[];
}

const GATED_FEATURES: FullFeatureId[] = ["setlists"];

export function isLocalDevEnvironment(): boolean {
  const override = process.env.RC600_FULL_FEATURES?.trim().toLowerCase();
  if (["1", "true", "on"].includes(override ?? "")) return true;
  if (["0", "false", "off"].includes(override ?? "")) return false;
  if (process.env.RENDER === "true") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function configuredPlanKeys(): string[] {
  const raw =
    process.env.RC600_FULL_PLAN_KEYS?.trim() ||
    process.env.RC600_FULL_PLAN_KEY?.trim() ||
    "";
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function isValidFullPlanKey(key: string | null | undefined): boolean {
  const candidate = key?.trim() ?? "";
  if (!candidate) return false;
  const keys = configuredPlanKeys();
  if (!keys.length) return false;
  return keys.some((k) => safeEqualString(k, candidate));
}

export function planKeyFromHeaders(headers: Headers): string | null {
  const header = headers.get(PLAN_KEY_HEADER);
  if (header?.trim()) return header.trim();
  return null;
}

export function deviceIdFromRequest(req: Request): string | null {
  return deviceIdFromHeader(req.headers.get(DEVICE_ID_HEADER));
}

function uaLabel(req: Request): string {
  return labelFromUserAgent(req.headers.get("user-agent") ?? undefined);
}

export function resolveEntitlements(req: Request): EntitlementsSnapshot {
  const localDev = isLocalDevEnvironment();
  const planKey = planKeyFromHeaders(req.headers);
  const deviceId = deviceIdFromRequest(req);
  const keyValid = isValidFullPlanKey(planKey);

  if (localDev) {
    const features = Object.fromEntries(GATED_FEATURES.map((id) => [id, true])) as Record<
      FullFeatureId,
      boolean
    >;
    return {
      localDev: true,
      fullPlan: keyValid,
      unlocked: true,
      features,
      maxDevices: MAX_DEVICES_PER_KEY,
      ...(keyValid && planKey
        ? {
            keyValid: true,
            deviceBound: true,
            deviceLimitReached: false,
            devices: listDevicesForKey(planKey, deviceId),
          }
        : { keyValid: false }),
    };
  }

  if (!keyValid || !planKey) {
    const features = Object.fromEntries(GATED_FEATURES.map((id) => [id, false])) as Record<
      FullFeatureId,
      boolean
    >;
    return {
      localDev: false,
      fullPlan: false,
      unlocked: false,
      features,
      keyValid: false,
      maxDevices: MAX_DEVICES_PER_KEY,
    };
  }

  const bind = ensureDeviceBound(planKey, deviceId, uaLabel(req));
  const deviceBound = bind.ok === true;
  const deviceLimitReached = bind.ok === false && bind.reason === "limit_reached";
  const fullPlan = deviceBound;
  const unlocked = fullPlan;
  const features = Object.fromEntries(GATED_FEATURES.map((id) => [id, unlocked])) as Record<
    FullFeatureId,
    boolean
  >;

  return {
    localDev: false,
    fullPlan,
    unlocked,
    features,
    keyValid: true,
    deviceBound,
    deviceLimitReached,
    maxDevices: MAX_DEVICES_PER_KEY,
    devices: bind.devices,
  };
}

export function featureAllowed(req: Request, feature: FullFeatureId): boolean {
  return resolveEntitlements(req).features[feature] === true;
}

/** Revoke a device seat for the plan key on this request (does not auto-bind). */
export function revokeDeviceForRequest(req: Request, targetDeviceId: string): {
  ok: boolean;
  error?: string;
  entitlements: EntitlementsSnapshot;
} {
  const planKey = planKeyFromHeaders(req.headers);
  const deviceId = deviceIdFromRequest(req);
  if (!isValidFullPlanKey(planKey) || !planKey) {
    return {
      ok: false,
      error: "Valid Full plan key required",
      entitlements: resolveEntitlements(req),
    };
  }
  const removed = revokeDevice(planKey, targetDeviceId);
  const devices = listDevicesForKey(planKey, deviceId);
  const deviceBound = devices.some((d) => d.current);
  const localDev = isLocalDevEnvironment();
  const unlocked = localDev || deviceBound;
  const features = Object.fromEntries(GATED_FEATURES.map((id) => [id, unlocked])) as Record<
    FullFeatureId,
    boolean
  >;
  return {
    ok: removed,
    error: removed ? undefined : "Device not found on this key",
    entitlements: {
      localDev,
      fullPlan: deviceBound,
      unlocked,
      features,
      keyValid: true,
      deviceBound: localDev ? true : deviceBound,
      deviceLimitReached: !localDev && !deviceBound && devices.length >= MAX_DEVICES_PER_KEY,
      maxDevices: MAX_DEVICES_PER_KEY,
      devices,
    },
  };
}
