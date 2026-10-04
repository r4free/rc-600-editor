/**
 * Local copy of issued license keys, so a key can be emailed later.
 * This file stays out of git. The server only needs the hash in licenses.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type IssuedLicense = {
  id: string;
  key: string;
  note?: string;
  expiresAt?: string;
  createdAt: string;
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

export function recordIssuedLicense(entry: IssuedLicense): void {
  const file = loadIssued();
  file.issued = [entry, ...file.issued.filter((item) => item.id !== entry.id)];
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
