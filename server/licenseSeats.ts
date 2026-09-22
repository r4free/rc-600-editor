/**
 * Full plan key ↔ device seat binding (max 3 browsers per access key).
 * Keys are stored as SHA-256 hashes; never write the raw access key to disk.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const MAX_DEVICES_PER_KEY = 3;
export const DEVICE_ID_HEADER = "x-rc600-device-id";

/** Throttle last-seen writes so health polling does not hammer disk. */
const LAST_SEEN_WRITE_MS = 60_000;

export interface LicenseDeviceRecord {
  id: string;
  label: string;
  boundAt: string;
  lastSeenAt: string;
}

export interface LicenseDevicePublic {
  id: string;
  label: string;
  lastSeenAt: string;
  current: boolean;
}

export type BindDeviceResult =
  | { ok: true; bound: true; devices: LicenseDevicePublic[] }
  | { ok: false; reason: "invalid_device"; devices: LicenseDevicePublic[] }
  | { ok: false; reason: "limit_reached"; devices: LicenseDevicePublic[] };

interface LicenseSeatsFile {
  version: number;
  /** keyHash → devices */
  keys: Record<string, LicenseDeviceRecord[]>;
}

const DEFAULT_PATH = resolve(process.cwd(), "data", "license-seats.json");

let cache: LicenseSeatsFile | null = null;
let cachePath: string | null = null;

function seatsPath(): string {
  const override = process.env.RC600_LICENSE_SEATS_PATH?.trim();
  return override || DEFAULT_PATH;
}

function emptyFile(): LicenseSeatsFile {
  return { version: 1, keys: {} };
}

export function hashPlanKey(key: string): string {
  return createHash("sha256").update(key.trim(), "utf8").digest("hex");
}

function loadFile(): LicenseSeatsFile {
  const path = seatsPath();
  if (cache && cachePath === path) return cache;
  if (!existsSync(path)) {
    cache = emptyFile();
    cachePath = path;
    return cache;
  }
  try {
    const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as Partial<LicenseSeatsFile>;
    const keys: Record<string, LicenseDeviceRecord[]> = {};
    if (parsed.keys && typeof parsed.keys === "object") {
      for (const [k, list] of Object.entries(parsed.keys)) {
        if (!Array.isArray(list)) continue;
        keys[k] = list
          .filter(
            (d): d is LicenseDeviceRecord =>
              !!d &&
              typeof d === "object" &&
              typeof d.id === "string" &&
              d.id.trim().length > 0,
          )
          .map((d) => ({
            id: d.id.trim(),
            label: typeof d.label === "string" && d.label.trim() ? d.label.trim() : "Unknown",
            boundAt: typeof d.boundAt === "string" ? d.boundAt : new Date().toISOString(),
            lastSeenAt: typeof d.lastSeenAt === "string" ? d.lastSeenAt : new Date().toISOString(),
          }));
      }
    }
    cache = {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      keys,
    };
    cachePath = path;
    return cache;
  } catch {
    cache = emptyFile();
    cachePath = path;
    return cache;
  }
}

function persist(file: LicenseSeatsFile): void {
  const path = seatsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  cache = file;
  cachePath = path;
}

/** Reset in-memory cache (tests). */
export function resetLicenseSeatsCache(): void {
  cache = null;
  cachePath = null;
}

export function isValidDeviceId(id: string | null | undefined): boolean {
  const v = id?.trim() ?? "";
  return /^[A-Za-z0-9_-]{8,128}$/.test(v);
}

export function deviceIdFromHeader(value: string | string[] | null | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]?.trim()) return value[0]!.trim();
  return null;
}

/** Short UA label for the seat list (e.g. "Chrome · Windows"). */
export function labelFromUserAgent(ua: string | undefined): string {
  const s = ua?.trim() || "";
  let browser = "Browser";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/Chrome\//i.test(s) && !/Edg\//i.test(s)) browser = "Chrome";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s) && !/Chrome\//i.test(s)) browser = "Safari";

  let os = "Unknown";
  if (/Windows/i.test(s)) os = "Windows";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(s)) os = "macOS";
  else if (/Linux/i.test(s)) os = "Linux";

  return `${browser} · ${os}`;
}

function toPublic(devices: LicenseDeviceRecord[], currentId: string | null): LicenseDevicePublic[] {
  return devices.map((d) => ({
    id: d.id,
    label: d.label,
    lastSeenAt: d.lastSeenAt,
    current: currentId !== null && d.id === currentId,
  }));
}

function devicesForHash(file: LicenseSeatsFile, keyHash: string): LicenseDeviceRecord[] {
  return file.keys[keyHash] ?? [];
}

/**
 * Ensure this device is bound to the plan key (auto-bind when under the limit).
 * Does not validate that `planKey` is a configured Full plan key — caller must.
 */
export function ensureDeviceBound(
  planKey: string,
  deviceId: string | null | undefined,
  label: string,
): BindDeviceResult {
  const id = deviceId?.trim() ?? "";
  if (!isValidDeviceId(id)) {
    return { ok: false, reason: "invalid_device", devices: [] };
  }

  const keyHash = hashPlanKey(planKey);
  const file = loadFile();
  const list = [...devicesForHash(file, keyHash)];
  const existing = list.find((d) => d.id === id);
  const now = new Date().toISOString();

  if (existing) {
    const last = Date.parse(existing.lastSeenAt);
    const shouldWrite =
      !Number.isFinite(last) || Date.now() - last >= LAST_SEEN_WRITE_MS || existing.label !== label;
    if (shouldWrite) {
      existing.lastSeenAt = now;
      if (label) existing.label = label;
      file.keys[keyHash] = list;
      persist(file);
    }
    return { ok: true, bound: true, devices: toPublic(list, id) };
  }

  if (list.length >= MAX_DEVICES_PER_KEY) {
    return { ok: false, reason: "limit_reached", devices: toPublic(list, id) };
  }

  list.push({ id, label: label || "Unknown", boundAt: now, lastSeenAt: now });
  file.keys[keyHash] = list;
  persist(file);
  return { ok: true, bound: true, devices: toPublic(list, id) };
}

export function listDevicesForKey(planKey: string, currentDeviceId: string | null): LicenseDevicePublic[] {
  const file = loadFile();
  return toPublic(devicesForHash(file, hashPlanKey(planKey)), currentDeviceId);
}

export function isDeviceBound(planKey: string, deviceId: string | null | undefined): boolean {
  const id = deviceId?.trim() ?? "";
  if (!isValidDeviceId(id)) return false;
  const list = devicesForHash(loadFile(), hashPlanKey(planKey));
  return list.some((d) => d.id === id);
}

/** Remove a seat. Returns true if a device was removed. */
export function revokeDevice(planKey: string, deviceId: string): boolean {
  const id = deviceId.trim();
  if (!id) return false;
  const keyHash = hashPlanKey(planKey);
  const file = loadFile();
  const list = devicesForHash(file, keyHash);
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) return false;
  if (next.length === 0) delete file.keys[keyHash];
  else file.keys[keyHash] = next;
  persist(file);
  return true;
}
