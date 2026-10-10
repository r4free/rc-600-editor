import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Absent or "full" is a normal key. "preview" can play and look, with limited saving. */
export type LicensePlan = "full" | "preview";

export type LicenseRecord = {
  id: string;
  /** sha256 hex of normalized key */
  keyHash: string;
  /** ISO timestamp; absent means the key is valid immediately */
  startsAt?: string;
  /** ISO timestamp; absent means the key never expires */
  expiresAt?: string;
  /** Omitted on older keys and on full keys. */
  plan?: LicensePlan;
  note?: string;
  createdAt: string;
  revoked?: boolean;
};

export type LicenseFile = {
  licenses: LicenseRecord[];
};

export type LicensePublic = {
  id: string;
  expiresAt?: string;
  note?: string;
  plan: LicensePlan;
};

export function readLicensePlan(value: unknown): LicensePlan {
  return value === "preview" ? "preview" : "full";
}

function licensesPath(): string {
  return resolve(process.cwd(), process.env.RC600_LICENSES_PATH || "data/licenses.json");
}

export function requireLicenseEnabled(): boolean {
  const v = (process.env.RC600_REQUIRE_LICENSE || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function normalizeKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashLicenseKey(key: string): string {
  return createHash("sha256").update(normalizeKey(key)).digest("hex");
}

/** Format: RC600-XXXX-XXXX-XXXX */
export function generateLicenseKey(): string {
  const raw = randomBytes(9).toString("hex").toUpperCase(); // 18 hex chars
  const parts = [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12), raw.slice(12, 16)];
  return `RC600-${parts[0]}-${parts[1]}-${parts[2]}`;
}

export function loadLicenses(): LicenseFile {
  const path = licensesPath();
  if (!existsSync(path)) return { licenses: [] };
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as LicenseFile;
    if (!data || !Array.isArray(data.licenses)) return { licenses: [] };
    return data;
  } catch {
    return { licenses: [] };
  }
}

export function saveLicenses(file: LicenseFile): void {
  const path = licensesPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n", "utf8");
}

export function createLicense(opts: {
  /** Omit for a lifetime key. Ignored when expiresAt is set. */
  days?: number;
  note?: string;
  key?: string;
  /** ISO timestamp. Omit to make the key valid immediately. */
  startsAt?: string;
  /** ISO timestamp. Omit (and omit days) for a key that never expires. */
  expiresAt?: string;
  plan?: LicensePlan;
}): { record: LicenseRecord; key: string } {
  const key = opts.key ? normalizeKey(opts.key) : generateLicenseKey();
  const record: LicenseRecord = {
    id: randomBytes(6).toString("hex"),
    keyHash: hashLicenseKey(key),
    note: opts.note,
    createdAt: new Date().toISOString(),
  };
  if (opts.plan === "preview") record.plan = "preview";
  if (opts.startsAt) record.startsAt = opts.startsAt;
  if (opts.expiresAt) {
    record.expiresAt = opts.expiresAt;
  } else if (opts.days !== undefined) {
    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + Math.max(1, opts.days));
    expires.setUTCHours(23, 59, 59, 999);
    record.expiresAt = expires.toISOString();
  }
  const file = loadLicenses();
  if (file.licenses.some((l) => l.keyHash === record.keyHash)) {
    throw new Error("License key already exists");
  }
  file.licenses.push(record);
  saveLicenses(file);
  return { record, key };
}

export function findValidLicense(key: string): LicenseRecord | null {
  const hash = hashLicenseKey(key);
  const lic = loadLicenses().licenses.find((l) => l.keyHash === hash);
  return lic && isLicenseStillValid(lic) ? lic : null;
}

function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** Why a key cannot be used right now, in words for the activation screen. */
export function licenseKeyError(key: string): string {
  const hash = hashLicenseKey(key);
  const lic = loadLicenses().licenses.find((l) => l.keyHash === hash);
  if (!lic || lic.revoked) return "Invalid license key";
  if (lic.startsAt && Date.parse(lic.startsAt) > Date.now()) {
    return `This key starts on ${dayText(lic.startsAt)}.`;
  }
  if (lic.expiresAt && Date.parse(lic.expiresAt) < Date.now()) {
    return `This key ended on ${dayText(lic.expiresAt)}.`;
  }
  return "Invalid or expired license key";
}

export function licensePublic(lic: LicenseRecord): LicensePublic {
  return {
    id: lic.id,
    expiresAt: lic.expiresAt,
    note: lic.note,
    plan: lic.plan === "preview" ? "preview" : "full",
  };
}

export function findLicenseById(id: string): LicenseRecord | null {
  return loadLicenses().licenses.find((l) => l.id === id) ?? null;
}

export function isLicenseStillValid(lic: LicenseRecord): boolean {
  if (lic.revoked) return false;
  if (lic.startsAt) {
    const start = Date.parse(lic.startsAt);
    if (!Number.isFinite(start) || start > Date.now()) return false;
  }
  if (!lic.expiresAt) return true;
  const exp = Date.parse(lic.expiresAt);
  return Number.isFinite(exp) && exp >= Date.now();
}
