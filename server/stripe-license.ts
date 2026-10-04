/**
 * After Stripe Checkout, confirm the session with the Stripe API and issue one license key.
 * The raw key is kept only so the same success URL can be reopened.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { STRIPE_PAYMENT_LINK } from "../src/buy-link.js";
import { createLicense, findValidLicense } from "./licenses.js";

const DEFAULT_AMOUNT_CENTS = 3900;

type FulfillmentFile = {
  sessions: Record<string, { key: string; licenseId: string; expiresAt?: string }>;
};

export type FulfillResult =
  | { ok: true; key: string; licenseId: string; expiresAt?: string }
  | { ok: false; status: 400 | 402 | 502 | 503; error: string };

export function stripePaymentLink(): string {
  const override = process.env.RC600_STRIPE_PAYMENT_LINK?.trim();
  return override || STRIPE_PAYMENT_LINK;
}

export function isCheckoutSessionId(value: string): boolean {
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(value) && value.length <= 255;
}

export async function fulfillStripeCheckout(sessionId: string): Promise<FulfillResult> {
  if (!isCheckoutSessionId(sessionId)) {
    return { ok: false, status: 400, error: "This payment link is missing a valid checkout reference." };
  }
  const existing = readFulfillment(sessionId);
  if (existing && findValidLicense(existing.key)) return { ok: true, ...existing };

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Payment was received, but this server cannot confirm it yet.",
    };
  }

  let session: StripeSession;
  try {
    session = await retrieveCheckoutSession(sessionId, secret);
  } catch {
    return { ok: false, status: 502, error: "Stripe could not be reached. Open this page again in a moment." };
  }
  if (session.id !== sessionId || session.payment_status !== "paid" || session.status !== "complete") {
    return { ok: false, status: 402, error: "This checkout is not paid yet." };
  }
  if (session.currency !== "usd" || session.amount_total !== expectedAmountCents()) {
    return { ok: false, status: 402, error: "This payment does not match the license price." };
  }

  const again = readFulfillment(sessionId);
  if (again && findValidLicense(again.key)) return { ok: true, ...again };

  const { key, record } = createLicense({ note: `stripe:${sessionId}` });
  const issued = { key, licenseId: record.id, expiresAt: record.expiresAt };
  writeFulfillment(sessionId, issued);
  return { ok: true, ...issued };
}

export function paidLicensePageHtml(result: FulfillResult, reference: string): string {
  const body = result.ok
    ? `<h1>Your license key</h1>
    <p>Save this key. It opens the RC-600 editor in this browser and in others.</p>
    <p class="key">${escapeHtml(result.key)}</p>
    <a class="go" href="/">Open editor</a>`
    : `<h1>License not ready</h1>
    <p>${escapeHtml(result.error)}</p>
    ${reference ? `<p class="ref">Reference: ${escapeHtml(reference)}</p>` : ""}
    <a class="go" href="/">Back</a>`;
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
    p { margin: 0.75rem 0 0; color: #8a9aaa; line-height: 1.45; font-size: 0.95rem; }
    .key {
      margin-top: 1rem;
      padding: 0.7rem 0.75rem;
      border: 1px solid #243044;
      border-radius: 6px;
      background: #1a2230;
      color: #dce6f0;
      font-family: ui-monospace, Consolas, monospace;
      letter-spacing: 0.02em;
      word-break: break-all;
    }
    .ref { font-family: ui-monospace, Consolas, monospace; word-break: break-all; }
    .go {
      display: block;
      margin-top: 1.1rem;
      border-radius: 6px;
      padding: 0.6rem 0.8rem;
      background: #0071c5;
      color: #fff;
      font-weight: 600;
      text-align: center;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main>
    ${body}
  </main>
</body>
</html>`;
}

type StripeSession = {
  id?: string;
  payment_status?: string;
  status?: string;
  currency?: string;
  amount_total?: number;
};

async function retrieveCheckoutSession(sessionId: string, secret: string): Promise<StripeSession> {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Stripe ${response.status}`);
  return (await response.json()) as StripeSession;
}

function expectedAmountCents(): number {
  const raw = Number(process.env.RC600_STRIPE_AMOUNT_CENTS ?? DEFAULT_AMOUNT_CENTS);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_AMOUNT_CENTS;
  return Math.floor(raw);
}

function fulfillmentsPath(): string {
  return resolve(process.cwd(), process.env.RC600_STRIPE_FULFILLMENTS_PATH || "data/stripe-fulfillments.json");
}

function readFulfillment(sessionId: string): { key: string; licenseId: string; expiresAt?: string } | null {
  const file = loadFulfillments();
  return file.sessions[sessionId] ?? null;
}

function writeFulfillment(
  sessionId: string,
  issued: { key: string; licenseId: string; expiresAt?: string },
): void {
  const file = loadFulfillments();
  file.sessions[sessionId] = issued;
  const path = fulfillmentsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n", "utf8");
}

function loadFulfillments(): FulfillmentFile {
  const path = fulfillmentsPath();
  if (!existsSync(path)) return { sessions: {} };
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as FulfillmentFile;
    if (!data || typeof data.sessions !== "object" || data.sessions == null) return { sessions: {} };
    return data;
  } catch {
    return { sessions: {} };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
