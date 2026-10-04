/**
 * Paid shell: until a license session exists, the server answers with a
 * standalone activation page and does not send editor files.
 */
import { DEMO_PAGE_ENABLED } from "../src/demo-page.js";
import { IOS_WEB_MIDI_BROWSER_URL } from "../src/midi/rc600-midi.js";
import { requireLicenseEnabled } from "./licenses.js";
import { SESSION_COOKIE, verifyLicenseSessionToken } from "./session.js";
import { stripePaymentLink } from "./stripe-license.js";

/** Plain text behind the activation-page Copy button. */
const REQUIREMENTS_COPY = `System requirements — RC-600 Web Editor

The editor runs in any modern web browser, on a computer, phone, or tablet.

Live MIDI to the RC-600 needs Web MIDI. Safari and Chrome on iPhone and iPad do not include Web MIDI, so connecting to the pedal over MIDI does not work in those browsers.

On iPhone or iPad, open the site in Web MIDI Browser (App Store: ${IOS_WEB_MIDI_BROWSER_URL}). Live MIDI then works the same way. On a computer, use Chrome or Edge.`;

export type ShellRequestKind = "api" | "document" | "asset" | "guide";

export type ShellDecision =
  | { action: "next" }
  | { action: "demo" }
  | { action: "redirect"; location: string }
  | { action: "page"; status: 200; html: string }
  | { action: "deny" };

/** Lets the view-only /demo page load its scripts. It is not a license session. */
export const DEMO_COOKIE = "rc600_demo";

export function demoViewCookie(): string {
  return `${DEMO_COOKIE}=1; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function demoViewAllowed(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) !== DEMO_COOKIE) continue;
    return trimmed.slice(eq + 1) === "1";
  }
  return false;
}

export function isDemoDocument(rawPath: string): boolean {
  return pathnameOf(rawPath) === "/demo";
}

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

/** Product photo on the activation page. Not an editor bundle. */
export function isActivationImage(rawPath: string): boolean {
  return pathnameOf(rawPath) === "/rc600-front.png";
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

export function decidePaidShell(
  rawPath: string,
  sessionOk: boolean,
  demoOk = false,
): ShellDecision {
  const kind = shellRequestKind(rawPath);
  if (!DEMO_PAGE_ENABLED && isDemoDocument(rawPath)) {
    return { action: "redirect", location: "/" };
  }
  if (kind === "api" || kind === "guide" || sessionOk || isActivationImage(rawPath)) {
    return { action: "next" };
  }
  if (DEMO_PAGE_ENABLED && isDemoDocument(rawPath)) return { action: "demo" };
  if (kind === "asset" && demoOk && DEMO_PAGE_ENABLED) return { action: "next" };
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
      background:
        radial-gradient(circle at 18% 8%, rgba(0, 113, 197, 0.2), transparent 32rem),
        linear-gradient(160deg, #101823, #0e1218 52%);
      color: #dce6f0;
      display: grid;
      place-items: center;
      padding: clamp(1rem, 3vw, 2rem);
    }
    main {
      width: min(100%, 67rem);
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(19rem, 0.8fr);
      align-items: center;
      gap: clamp(2rem, 6vw, 5.5rem);
      background:
        radial-gradient(circle at 10% 16%, rgba(0, 113, 197, 0.16), transparent 38%),
        #141a22;
      border: 1px solid #243044;
      padding: clamp(1.75rem, 5vw, 4.5rem);
    }
    .intro { max-width: 36rem; }
    .pedal {
      display: block;
      width: min(100%, 31rem);
      height: auto;
      margin: 0 0 1.15rem;
      filter: drop-shadow(0 0.75rem 1.25rem rgba(0, 0, 0, 0.42));
    }
    .eyebrow, .kicker {
      margin: 0;
      color: #00c7fd;
      font-family: ui-monospace, "Cascadia Code", monospace;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }
    h1 {
      max-width: 31rem;
      margin: 0.7rem 0 0;
      font-size: clamp(2rem, 4vw, 3.35rem);
      font-weight: 650;
      letter-spacing: -0.045em;
      line-height: 1.02;
    }
    .lead {
      max-width: 32rem;
      margin: 1.15rem 0 0;
      color: #8a9aaa;
      font-size: clamp(0.95rem, 1.5vw, 1.08rem);
      line-height: 1.65;
    }
    .features { display: grid; gap: 1rem; margin-top: 2rem; }
    .feature {
      display: grid;
      grid-template-columns: 2rem minmax(0, 1fr);
      gap: 0.75rem;
      align-items: start;
    }
    .feature-icon {
      display: grid;
      place-items: center;
      width: 1.65rem;
      height: 1.65rem;
      margin-top: 0.05rem;
      border: 1px solid #0071c5;
      border-radius: 50%;
      color: #00c7fd;
      font-family: ui-monospace, monospace;
      font-size: 0.72rem;
      font-weight: 700;
    }
    .feature h2 { margin: 0; font-size: 0.92rem; font-weight: 650; }
    .feature p {
      margin: 0.25rem 0 0;
      color: #8a9aaa;
      font-size: 0.82rem;
      line-height: 1.5;
    }
    .intro-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1.25rem;
      margin-top: 1.75rem;
    }
    button.guide {
      border: 0;
      padding: 0;
      background: none;
      cursor: pointer;
    }
    .guide {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: #00c7fd;
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none;
    }
    .req-dialog {
      width: min(32rem, calc(100% - 2rem));
      max-height: min(90vh, 36rem);
      margin: auto;
      padding: 1.15rem 1.25rem 1.3rem;
      border: 1px solid #304057;
      border-radius: 12px;
      background: #18212d;
      color: #dce6f0;
      box-shadow: 0 1.25rem 4rem rgba(0, 0, 0, 0.45);
    }
    .req-dialog::backdrop { background: rgba(0, 0, 0, 0.55); }
    .req-dialog-head {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 0;
    }
    .req-dialog h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    .req-dialog-actions { display: flex; gap: 0.4rem; }
    .req-dialog ul {
      margin: 0.9rem 0 0;
      padding-left: 1.15rem;
      color: #8a9aaa;
      font-size: 0.88rem;
      line-height: 1.55;
    }
    .req-dialog li + li { margin-top: 0.55rem; }
    .req-dialog a { color: #00c7fd; font-weight: 650; }
    .req-copy {
      padding: 0.35rem 0.7rem;
      border: 1px solid #3b4d65;
      border-radius: 6px;
      background: transparent;
      color: #dce6f0;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 650;
      cursor: pointer;
    }
    .req-copy:hover, .req-copy:focus-visible { border-color: #0071c5; }
    .req-source {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: pre;
      border: 0;
    }
    .guide:hover, .guide:focus-visible { text-decoration: underline; }
    .card {
      padding: clamp(1.35rem, 3vw, 2rem);
      border: 1px solid #304057;
      border-radius: 12px;
      background: #18212d;
      box-shadow: 0 1.25rem 4rem rgba(0, 0, 0, 0.28);
    }
    .card h2 {
      margin: 0.55rem 0 0;
      font-size: 1.55rem;
      letter-spacing: -0.025em;
    }
    .card-copy {
      margin: 0.55rem 0 0;
      color: #8a9aaa;
      font-size: 0.87rem;
      line-height: 1.5;
    }
    form { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 1.5rem; }
    label { font-size: 0.78rem; font-weight: 650; }
    input {
      width: 100%;
      padding: 0.72rem 0.8rem;
      border: 1px solid #243044;
      border-radius: 7px;
      outline: none;
      background: #0a0e14;
      color: inherit;
      font: 0.88rem ui-monospace, "Cascadia Code", monospace;
      letter-spacing: 0.02em;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }
    input:focus {
      border-color: #0071c5;
      box-shadow: 0 0 0 3px rgba(0, 113, 197, 0.24);
    }
    input::placeholder { color: #637488; }
    .primary, .buy {
      min-height: 2.6rem;
      border-radius: 7px;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 650;
      cursor: pointer;
    }
    .primary {
      margin-top: 0.35rem;
      border: 0;
      background: #0071c5;
      color: #fff;
    }
    .primary:hover, .primary:focus-visible { background: #0783df; }
    .err { margin: 0.2rem 0 0; color: #e17959; font-size: 0.8rem; line-height: 1.4; }
    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.35rem 0 1rem;
      color: #8a9aaa;
      font-size: 0.72rem;
    }
    .divider::before, .divider::after {
      content: "";
      height: 1px;
      flex: 1;
      background: #243044;
    }
    .buy {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      border: 1px solid #3b4d65;
      color: #dce6f0;
      text-decoration: none;
      transition: border-color 140ms ease, background-color 140ms ease;
    }
    .buy:hover, .buy:focus-visible {
      border-color: #0071c5;
      background: rgba(0, 113, 197, 0.12);
    }
    .purchase-note {
      margin: 0.75rem 0 0;
      color: #8a9aaa;
      font-size: 0.72rem;
      line-height: 1.45;
      text-align: center;
    }
    @media (max-width: 760px) {
      body { display: block; }
      main {
        grid-template-columns: 1fr;
        gap: 2rem;
        padding: 1.5rem;
      }
      .intro { max-width: none; }
    }
  </style>
</head>
<body>
  <main>
    <section class="intro" aria-labelledby="page-title">
      <img class="pedal" src="/rc600-front.png" alt="BOSS RC-600 Loop Station" width="581" height="215" />
      <p class="eyebrow">BOSS RC-600 · WEB EDITOR</p>
      <h1 id="page-title">Your RC-600, easier to organize.</h1>
      <p class="lead">Edit memories, system settings, and performance tools from one focused workspace in your browser.</p>
      <div class="features">
        <div class="feature">
          <span class="feature-icon" aria-hidden="true">01</span>
          <div>
            <h2>Shape every memory</h2>
            <p>Adjust loop tracks, effects, routing, assignments, and more with readable controls.</p>
          </div>
        </div>
        <div class="feature">
          <span class="feature-icon" aria-hidden="true">02</span>
          <div>
            <h2>Work your way</h2>
            <p>Open an RC-600 backup or connect with Web MIDI in a compatible browser.</p>
          </div>
        </div>
        <div class="feature">
          <span class="feature-icon" aria-hidden="true">03</span>
          <div>
            <h2>Get ready to play</h2>
            <p>Build setlists and use live charts, tuner, and rhythm tools in the same editor.</p>
          </div>
        </div>
      </div>
      <p class="intro-links">
        <button type="button" class="guide" onclick="document.getElementById('system-requirements').showModal()">System requirements</button>
        <a class="guide" href="/guia.html" target="_blank" rel="noopener noreferrer">Explore the user guide <span aria-hidden="true">↗</span></a>
      </p>
    </section>
    <section class="card" aria-labelledby="activation-title">
      <p class="kicker">Already have a license?</p>
      <h2 id="activation-title">Welcome back</h2>
      <p class="card-copy">Enter the key from your purchase email to open the editor.</p>
      <form method="post" action="/api/license">
        <label for="license-key">License key</label>
        <input id="license-key" name="key" type="text" autocomplete="off" spellcheck="false" placeholder="RC600-XXXX-XXXX-XXXX" required autofocus />
        ${alert}
        <button class="primary" type="submit">Open editor</button>
      </form>
      <div class="divider"><span>New to the editor?</span></div>
      <a class="buy" href="${escapeHtml(stripePaymentLink())}">Get a license <span aria-hidden="true">↗</span></a>
      <p class="purchase-note">Secure checkout. Your license key is sent by email after payment.</p>
    </section>
  </main>
  <dialog id="system-requirements" class="req-dialog" aria-labelledby="system-requirements-title" onclick="if(event.target===this)this.close()">
    <form method="dialog" class="req-dialog-head">
      <h2 id="system-requirements-title">System requirements</h2>
      <div class="req-dialog-actions">
        <button type="button" class="req-copy" onclick="var b=this;navigator.clipboard.writeText(document.getElementById('req-copy-text').value).then(function(){b.textContent='Copied'})">Copy</button>
        <button type="submit" class="req-copy">Close</button>
      </div>
    </form>
    <ul>
      <li>Runs in any modern browser, on a computer, phone, or tablet.</li>
      <li>Live MIDI to the RC-600 needs Web MIDI. Safari and Chrome on iPhone and iPad do not include it, so the MIDI connection does not work there.</li>
      <li>On iPhone or iPad, open this site in <a href="${escapeHtml(IOS_WEB_MIDI_BROWSER_URL)}" target="_blank" rel="noopener noreferrer">Web MIDI Browser</a> and live MIDI works. On a computer, use Chrome or Edge.</li>
    </ul>
    <textarea id="req-copy-text" class="req-source" readonly tabindex="-1" aria-hidden="true">${escapeHtml(REQUIREMENTS_COPY)}</textarea>
  </dialog>
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
