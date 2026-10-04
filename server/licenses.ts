import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type LicenseRecord = {
  id: string;
  /** sha256 hex of normalized key */
  keyHash: string;
  /** ISO timestamp; absent means the key never expires */
  expiresAt?: string;
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
};

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
  /** Omit for a lifetime key */
  days?: number;
  note?: string;
  key?: string;
}): { record: LicenseRecord; key: string } {
  const key = opts.key ? normalizeKey(opts.key) : generateLicenseKey();
  const record: LicenseRecord = {
    id: randomBytes(6).toString("hex"),
    keyHash: hashLicenseKey(key),
    note: opts.note,
    createdAt: new Date().toISOString(),
  };
  if (opts.days !== undefined) {
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

export function licensePublic(lic: LicenseRecord): LicensePublic {
  return {
    id: lic.id,
    expiresAt: lic.expiresAt,
    note: lic.note,
  };
}

export function findLicenseById(id: string): LicenseRecord | null {
  return loadLicenses().licenses.find((l) => l.id === id) ?? null;
}

export function isLicenseStillValid(lic: LicenseRecord): boolean {
  if (lic.revoked) return false;
  return !lic.expiresAt || Date.parse(lic.expiresAt) >= Date.now();
}
