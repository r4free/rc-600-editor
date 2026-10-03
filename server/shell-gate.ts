/**
 * Paid shell: until a license session exists, the server answers with a
 * standalone activation page and does not send editor files.
 */
import { requireLicenseEnabled } from "./licenses.js";
import { SESSION_COOKIE, verifyLicenseSessionToken } from "./session.js";
import { stripePaymentLink } from "./stripe-license.js";

export type ShellRequestKind = "api" | "document" | "asset" | "guide";

export type ShellDecision =
  | { action: "next" }
  | { action: "page"; status: 200; html: string }
  | { action: "deny" };

const PUBLIC_API = new Set(["/api/health", "/api/session", "/api/license", "/api/lock"]);

export function isPublicApiPath(path: string): boolean {
  const bare = pathnameOf(path);
  return PUBLIC_API.has(bare);
}

export function isFormActivation(contentType: string | undefined): boolean {
  const ctype = (contentType ?? "").toLowerCase();
  return (
    ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data")
  );
}

/** User guide stays readable from the activation page. */
export function isGuidePath(rawPath: string): boolean {
  const pathOnly = pathnameOf(rawPath);
  return (
    pathOnly === "/guia.html" ||
    pathOnly === "/guia.css" ||
    pathOnly === "/guia.js" ||
    pathOnly.startsWith("/guide-images/")
  );
}

/** Classify a URL before any editor file is considered. */
export function shellRequestKind(rawPath: string): ShellRequestKind {
  const pathOnly = pathnameOf(rawPath);
  if (pathOnly === "/api" || pathOnly.startsWith("/api/")) return "api";
  if (isGuidePath(pathOnly)) return "guide";
  if (pathOnly === "/" || pathOnly === "/index.html") return "document";
  if (
    pathOnly.startsWith("/src/") ||
    pathOnly.startsWith("/@") ||
    pathOnly.startsWith("/node_modules/") ||
    pathOnly.startsWith("/assets/") ||
    pathOnly.startsWith("/__")
  ) {
    return "asset";
  }
  if (/\.[a-z0-9]+$/i.test(pathOnly)) return "asset";
  return "document";
}

export function sessionTokenFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) !== SESSION_COOKIE) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

/** True when the editor files may be sent (open mode, or a live license cookie). */
export function appShellAllowed(cookieHeader: string | undefined): boolean {
  if (!requireLicenseEnabled()) return true;
  return verifyLicenseSessionToken(sessionTokenFromCookie(cookieHeader)) != null;
}

export function decidePaidShell(rawPath: string, sessionOk: boolean): ShellDecision {
  const kind = shellRequestKind(rawPath);
  if (kind === "api" || kind === "guide" || sessionOk) return { action: "next" };
  if (kind === "document") {
    return { action: "page", status: 200, html: activationPageHtml() };
  }
  return { action: "deny" };
}

export function activationPageHtml(error?: string): string {
  const alert = error
    ? `<p class="err" role="alert">${escapeHtml(error)}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>RC-600 Editor</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #0e1218;
      color: #dce6f0;
      display: grid;
      place-items: center;
      padding: 1.5rem;
    }
    main {
      width: min(100%, 24rem);
      background: #141a22;
      border: 1px solid #243044;
      padding: 1.5rem 1.35rem 1.35rem;
    }
    h1 { margin: 0 0 0.35rem; font-size: 1.35rem; font-weight: 650; }
    p { margin: 0; color: #8a9aaa; line-height: 1.45; font-size: 0.95rem; }
    form { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 1.25rem; }
    label { font-size: 0.8rem; font-weight: 600; }
    input {
      width: 100%;
      padding: 0.6rem 0.7rem;
      border: 1px solid #243044;
      border-radius: 6px;
      background: #1a2230;
      color: inherit;
      font: inherit;
    }
    button {
      margin-top: 0.35rem;
      border: 0;
      border-radius: 6px;
      padding: 0.6rem 0.8rem;
      background: #0071c5;
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .err { color: #d96a4a; margin-top: 0.85rem; }
    .buy {
      display: block;
      margin-top: 1.15rem;
      border-radius: 6px;
      padding: 0.6rem 0.8rem;
      background: #0071c5;
      color: #fff;
      font-weight: 600;
      text-align: center;
      text-decoration: none;
    }
    .guide { margin-top: 1rem; text-align: center; }
    .guide a { color: #00c7fd; }
  </style>
</head>
<body>
  <main>
    <h1>Enter license key</h1>
    <p>Enter your license key to open the RC-600 editor. After payment, the key is sent by email.</p>
    <a class="buy" href="${escapeHtml(stripePaymentLink())}">Buy license</a>
    <form method="post" action="/api/license">
      <label for="license-key">License key</label>
      <input id="license-key" name="key" type="text" autocomplete="off" spellcheck="false" placeholder="RC600-XXXX-XXXX-XXXX" required autofocus />
      ${alert}
      <button type="submit">Activate</button>
    </form>
    <p class="guide"><a href="/guia.html" target="_blank" rel="noopener noreferrer">Guide</a></p>
  </main>
</body>
</html>
`;
}

function pathnameOf(rawPath: string): string {
  const noQuery = (rawPath.split("?")[0] ?? "/").split("#")[0] || "/";
  if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
  return noQuery || "/";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
