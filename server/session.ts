import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  findLicenseById,
  isLicenseStillValid,
  licensePublic,
  requireLicenseEnabled,
  type LicensePublic,
} from "./licenses.js";

export const SESSION_COOKIE = "rc600_session";
/** Chrome caps persistent cookies at 400 days. Lifetime licenses stay signed in. */
const MAX_AGE_SEC = 60 * 60 * 24 * 400;

/** Stable across deploys: a changing secret signs every browser out. */
function secret(): string {
  const fromEnv = process.env.RC600_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.RENDER) {
    const serviceId = process.env.RENDER_SERVICE_ID?.trim() || "render";
    return createHash("sha256")
      .update(`50a3727bca3b664ac210c5f2bb33d6839d7e003e4f72bf9dcc05a57f8e285aad:${serviceId}`)
      .digest("hex");
  }
  return "dev-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Payload: lic.<licenseId>.<expMs> */
export function createLicenseSessionToken(licenseId: string, expiresAtIso?: string): string {
  const licenseExp = expiresAtIso ? Date.parse(expiresAtIso) : Infinity;
  const sessionExp = Math.min(Date.now() + MAX_AGE_SEC * 1000, licenseExp);
  const payload = `lic.${licenseId}.${sessionExp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyLicenseSessionToken(
  token: string | undefined,
): { licenseId: string } | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const parts = payload.split(".");
  if (parts[0] !== "lic" || parts.length !== 3) return null;
  const licenseId = parts[1]!;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const lic = findLicenseById(licenseId);
  if (!lic || !isLicenseStillValid(lic)) return null;
  return { licenseId };
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export type SessionInfo = {
  ok: boolean;
  mode: "open" | "license";
  requireLicense: boolean;
  license: LicensePublic | null;
  /** "preview" when the active key is a preview key. "full" otherwise, including open mode with no key. */
  plan: "full" | "preview";
};

function licenseFromCookie(c: Context): LicensePublic | null {
  const verified = verifyLicenseSessionToken(getCookie(c, SESSION_COOKIE));
  if (!verified) return null;
  const lic = findLicenseById(verified.licenseId);
  if (!lic || !isLicenseStillValid(lic)) return null;
  return licensePublic(lic);
}

export function readSessionInfo(c: Context): SessionInfo {
  const requireLicense = requireLicenseEnabled();
  const license = licenseFromCookie(c);
  const plan = license?.plan === "preview" ? "preview" : "full";
  if (!requireLicense) {
    return { ok: true, mode: "open", requireLicense: false, license: null, plan };
  }
  if (!license) {
    return { ok: false, mode: "license", requireLicense: true, license: null, plan: "full" };
  }
  return {
    ok: true,
    mode: "license",
    requireLicense: true,
    license,
    plan,
  };
}

/** Allow assemble when open mode, or when a valid license session exists. */
export async function requireAccess(c: Context, next: Next) {
  const info = readSessionInfo(c);
  if (!info.ok) {
    return c.json({ error: "License required or expired" }, 401);
  }
  await next();
}
