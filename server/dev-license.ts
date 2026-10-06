/**
 * Issue a license from the local editor only.
 * Production (NODE_ENV or Render) and any non-local host are refused.
 * There is no flag that turns this on.
 */
import { createLicense } from "./licenses.js";
import { recordIssuedLicense } from "./issued-licenses.js";

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
}): { key: string; id: string; note: string; startsAt?: string; expiresAt?: string } {
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
  if (expiresAt && Date.parse(expiresAt) < Date.now()) {
    throw new Error("End date is already past");
  }

  const note = location ? `${email}-${name} (${location})` : `${email}-${name}`;
  const { record, key } = createLicense({ note, startsAt, expiresAt });
  recordIssuedLicense({
    id: record.id,
    key,
    note: record.note,
    startsAt: record.startsAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  });
  return {
    key,
    id: record.id,
    note,
    startsAt: record.startsAt,
    expiresAt: record.expiresAt,
  };
}

function optionalIso(value: unknown, label: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} is invalid`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`${label} is invalid`);
  return new Date(ms).toISOString();
}
