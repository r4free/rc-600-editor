/**
 * Local copy of issued license keys, so a key can be emailed later.
 * This file stays out of git. The server only needs the hash in licenses.json.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type IssuedLicense = {
  id: string;
  key: string;
  name?: string;
  email?: string;
  location?: string;
  note?: string;
  /** "preview" or "full". Absent on keys issued before plans existed. */
  plan?: "full" | "preview";
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
};

type IssuedFile = {
  issued: IssuedLicense[];
};

export function issuedLicensesPath(): string {
  return resolve(
    process.cwd(),
    process.env.RC600_ISSUED_LICENSES_PATH || "data/issued-licenses.json",
  );
}

export function licenseLogPath(): string {
  return resolve(process.cwd(), process.env.RC600_LICENSE_LOG_PATH || "data/license-log.jsonl");
}

export function recordIssuedLicense(entry: IssuedLicense): void {
  const file = loadIssued();
  file.issued = [entry, ...file.issued.filter((item) => item.id !== entry.id)];
  saveIssued(file);
}

export function listIssuedLicenses(): IssuedLicense[] {
  return loadIssued().issued;
}

export function replaceIssuedLicense(entry: IssuedLicense): void {
  const file = loadIssued();
  const index = file.issued.findIndex((item) => item.id === entry.id);
  if (index >= 0) file.issued[index] = entry;
  else file.issued.unshift(entry);
  saveIssued(file);
}

export function removeIssuedLicense(id: string): IssuedLicense | null {
  const file = loadIssued();
  const found = file.issued.find((item) => item.id === id) ?? null;
  if (!found) return null;
  file.issued = file.issued.filter((item) => item.id !== id);
  saveIssued(file);
  return found;
}

/** Append-only history of every create, edit and delete, so no key data is lost. */
export function appendLicenseLog(entry: {
  action: "create" | "update" | "delete";
  id: string;
  before?: unknown;
  after?: unknown;
}): void {
  const path = licenseLogPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "utf8");
}

function saveIssued(file: IssuedFile): void {
  const path = issuedLicensesPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n", "utf8");
}

function loadIssued(): IssuedFile {
  const path = issuedLicensesPath();
  if (!existsSync(path)) return { issued: [] };
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as IssuedFile;
    if (!data || !Array.isArray(data.issued)) return { issued: [] };
    return data;
  } catch {
    return { issued: [] };
  }
}
