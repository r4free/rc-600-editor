/**
 * Issue a license from the local editor only.
 * Production (NODE_ENV or Render) and any non-local host are refused.
 * There is no flag that turns this on.
 */
import {
  createLicense,
  loadLicenses,
  readLicensePlan,
  saveLicenses,
  type LicensePlan,
  type LicenseRecord,
} from "./licenses.js";
import {
  appendLicenseLog,
  listIssuedLicenses,
  recordIssuedLicense,
  removeIssuedLicense,
  replaceIssuedLicense,
  type IssuedLicense,
} from "./issued-licenses.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "rc.test"]);

export function devLicenseIssuerAllowed(
  env: NodeJS.ProcessEnv = process.env,
  hostHeader?: string,
  forwardedHost?: string,
): boolean {
  if (env.RENDER) return false;
  if ((env.NODE_ENV ?? "").toLowerCase() === "production") return false;
  const names = hostNames(hostHeader, forwardedHost);
  if (names.length === 0) return false;
  return names.every((name) => LOCAL_HOSTS.has(name));
}

function hostNames(hostHeader?: string, forwardedHost?: string): string[] {
  const names: string[] = [];
  const raw = [hostHeader, ...(forwardedHost?.split(",") ?? [])];
  for (const part of raw) {
    const name = (part ?? "").trim().split(":")[0]?.toLowerCase() ?? "";
    if (name) names.push(name);
  }
  return names;
}

export function issueLocalLicense(input: {
  name?: unknown;
  email?: unknown;
  location?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
  plan?: unknown;
}): { key: string; id: string; note: string; plan: LicensePlan; startsAt?: string; expiresAt?: string } {
  const { name, email, location, startsAt, expiresAt, plan } = readLicenseFields(input);
  if (expiresAt && Date.parse(expiresAt) < Date.now()) {
    throw new Error("End date is already past");
  }

  const note = licenseNote(name, email, location);
  const { record, key } = createLicense({ note, startsAt, expiresAt, plan });
  const local: IssuedLicense = {
    id: record.id,
    key,
    name,
    email,
    ...(location ? { location } : {}),
    note: record.note,
    plan,
    startsAt: record.startsAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
  recordIssuedLicense(local);
  appendLicenseLog({ action: "create", id: record.id, after: { public: record, local } });
  return {
    key,
    id: record.id,
    note,
    plan,
    startsAt: record.startsAt,
    expiresAt: record.expiresAt,
  };
}

export type ManagedLicense = {
  id: string;
  /** Absent when the key was not issued from this computer (only its hash is known). */
  key?: string;
  name: string;
  email: string;
  location: string;
  note?: string;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
  revoked?: boolean;
  plan: LicensePlan;
  /** In data/licenses.json, so the public site accepts it once deployed. */
  inPublicFile: boolean;
  /** In data/issued-licenses.json, so the key can be emailed again. */
  inLocalFile: boolean;
};

/** Both files merged, newest first. */
export function listLocalLicenses(): ManagedLicense[] {
  const publicById = new Map(loadLicenses().licenses.map((l) => [l.id, l]));
  const localById = new Map(listIssuedLicenses().map((l) => [l.id, l]));
  const ids = new Set([...publicById.keys(), ...localById.keys()]);
  const list: ManagedLicense[] = [];
  for (const id of ids) {
    const pub = publicById.get(id);
    const local = localById.get(id);
    const note = local?.note ?? pub?.note;
    const parsed = parseLicenseNote(note);
    list.push({
      id,
      key: local?.key,
      name: local?.name ?? parsed.name,
      email: local?.email ?? parsed.email,
      location: local?.location ?? parsed.location,
      note,
      startsAt: pub ? pub.startsAt : local?.startsAt,
      expiresAt: pub ? pub.expiresAt : local?.expiresAt,
      createdAt: pub?.createdAt ?? local?.createdAt ?? "",
      updatedAt: local?.updatedAt,
      revoked: pub?.revoked,
      plan: pub ? (pub.plan === "preview" ? "preview" : "full") : local?.plan === "preview" ? "preview" : "full",
      inPublicFile: Boolean(pub),
      inLocalFile: Boolean(local),
    });
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateLocalLicense(
  id: string,
  input: {
    name?: unknown;
    email?: unknown;
    location?: unknown;
    startsAt?: unknown;
    expiresAt?: unknown;
    plan?: unknown;
  },
): ManagedLicense {
  const before = snapshot(id);
  if (!before.public && !before.local) throw new Error("License not found");
  const { name, email, location, startsAt, expiresAt, plan } = readLicenseFields(input);
  const note = licenseNote(name, email, location);
  const updatedAt = new Date().toISOString();

  let nextPublic: LicenseRecord | null = null;
  if (before.public) {
    const file = loadLicenses();
    file.licenses = file.licenses.map((l) => {
      if (l.id !== id) return l;
      const next: LicenseRecord = { ...l, note };
      setOptional(next, "startsAt", startsAt);
      setOptional(next, "expiresAt", expiresAt);
      setOptional(next, "plan", plan === "preview" ? "preview" : undefined);
      nextPublic = next;
      return next;
    });
    saveLicenses(file);
  }

  let nextLocal: IssuedLicense | null = null;
  if (before.local) {
    nextLocal = { ...before.local, name, email, note, plan, updatedAt };
    setOptional(nextLocal, "location", location || undefined);
    setOptional(nextLocal, "startsAt", startsAt);
    setOptional(nextLocal, "expiresAt", expiresAt);
    replaceIssuedLicense(nextLocal);
  }

  appendLicenseLog({ action: "update", id, before, after: { public: nextPublic, local: nextLocal } });
  const updated = listLocalLicenses().find((l) => l.id === id);
  if (!updated) throw new Error("License not found");
  return updated;
}

export function deleteLocalLicense(id: string): void {
  const before = snapshot(id);
  if (!before.public && !before.local) throw new Error("License not found");
  if (before.public) {
    const file = loadLicenses();
    file.licenses = file.licenses.filter((l) => l.id !== id);
    saveLicenses(file);
  }
  if (before.local) removeIssuedLicense(id);
  appendLicenseLog({ action: "delete", id, before });
}

function snapshot(id: string): { public: LicenseRecord | null; local: IssuedLicense | null } {
  return {
    public: loadLicenses().licenses.find((l) => l.id === id) ?? null,
    local: listIssuedLicenses().find((l) => l.id === id) ?? null,
  };
}

function setOptional<T extends object, K extends keyof T>(target: T, field: K, value: T[K] | undefined): void {
  if (value === undefined) delete target[field];
  else target[field] = value;
}

function readLicenseFields(input: {
  name?: unknown;
  email?: unknown;
  location?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
  plan?: unknown;
}): { name: string; email: string; location: string; plan: LicensePlan; startsAt?: string; expiresAt?: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const location = typeof input.location === "string" ? input.location.trim() : "";
  if (!name) throw new Error("Name is required");
  if (name.length > 120) throw new Error("Name is too long");
  if (!EMAIL.test(email) || email.length > 200) throw new Error("Email is required");
  if (location.length > 200) throw new Error("Location is too long");
  const startsAt = optionalIso(input.startsAt, "Start date");
  const expiresAt = optionalIso(input.expiresAt, "End date");
  if (startsAt && expiresAt && Date.parse(expiresAt) < Date.parse(startsAt)) {
    throw new Error("End date is before the start date");
  }
  return { name, email, location, plan: readLicensePlan(input.plan), startsAt, expiresAt };
}

function licenseNote(name: string, email: string, location: string): string {
  return location ? `${email}-${name} (${location})` : `${email}-${name}`;
}

/** Reads `email-Name (Location)` notes written before name and email were stored separately. */
export function parseLicenseNote(note: string | undefined): { name: string; email: string; location: string } {
  const text = (note ?? "").trim();
  const match = /^([^\s@]+@[^\s@]+?\.[a-z]{2,})-(.+?)(?: \(([^)]*)\))?$/i.exec(text);
  if (!match) return { name: text, email: "", location: "" };
  return { email: match[1]!.toLowerCase(), name: match[2]!.trim(), location: (match[3] ?? "").trim() };
}

function optionalIso(value: unknown, label: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} is invalid`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${label} is invalid`);
  return new Date(ms).toISOString();
}
