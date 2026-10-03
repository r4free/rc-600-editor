import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { findValidLicense } from "./licenses.js";
import { fulfillStripeCheckout, isCheckoutSessionId, paidLicensePageHtml } from "./stripe-license.js";

const SESSION = "cs_test_paidlicense0001";

describe("stripe license fulfillment", () => {
  let dir: string;
  let prevLicenses: string | undefined;
  let prevFulfill: string | undefined;
  let prevSecret: string | undefined;
  let prevAmount: string | undefined;
  let prevDays: string | undefined;
  const originalFetch = globalThis.fetch;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rc600-stripe-"));
    prevLicenses = process.env.RC600_LICENSES_PATH;
    prevFulfill = process.env.RC600_STRIPE_FULFILLMENTS_PATH;
    prevSecret = process.env.STRIPE_SECRET_KEY;
    prevAmount = process.env.RC600_STRIPE_AMOUNT_CENTS;
    prevDays = process.env.RC600_LICENSE_DAYS;
    process.env.RC600_LICENSES_PATH = join(dir, "licenses.json");
    process.env.RC600_STRIPE_FULFILLMENTS_PATH = join(dir, "stripe-fulfillments.json");
    process.env.STRIPE_SECRET_KEY = "sk_test_secret";
    process.env.RC600_STRIPE_AMOUNT_CENTS = "3900";
    process.env.RC600_LICENSE_DAYS = "30";
  });

  after(() => {
    globalThis.fetch = originalFetch;
    restore("RC600_LICENSES_PATH", prevLicenses);
    restore("RC600_STRIPE_FULFILLMENTS_PATH", prevFulfill);
    restore("STRIPE_SECRET_KEY", prevSecret);
    restore("RC600_STRIPE_AMOUNT_CENTS", prevAmount);
    restore("RC600_LICENSE_DAYS", prevDays);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a checkout reference that is not a Stripe session id", async () => {
    assert.equal(isCheckoutSessionId("cs_test_ok"), true);
    assert.equal(isCheckoutSessionId("not-a-session"), false);
    const result = await fulfillStripeCheckout("pls_nope");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });

  it("issues one key for a paid session and repeats that key", async () => {
    globalThis.fetch = mockSession({
      id: SESSION,
      payment_status: "paid",
      status: "complete",
      currency: "usd",
      amount_total: 3900,
    });
    const first = await fulfillStripeCheckout(SESSION);
    const second = await fulfillStripeCheckout(SESSION);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.key, second.key);
    assert.equal(findValidLicense(first.key)?.id, first.licenseId);
    const html = paidLicensePageHtml(first, SESSION);
    assert.match(html, new RegExp(first.key));
    assert.equal(html.includes("<script"), false);
  });

  it("does not issue a key when the checkout is unpaid or the price does not match", async () => {
    globalThis.fetch = mockSession({
      id: "cs_test_unpaid0001",
      payment_status: "unpaid",
      status: "open",
      currency: "usd",
      amount_total: 3900,
    });
    const unpaid = await fulfillStripeCheckout("cs_test_unpaid0001");
    assert.equal(unpaid.ok, false);

    globalThis.fetch = mockSession({
      id: "cs_test_wrongprice01",
      payment_status: "paid",
      status: "complete",
      currency: "usd",
      amount_total: 3500,
    });
    const wrong = await fulfillStripeCheckout("cs_test_wrongprice01");
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.status, 402);
  });
});

function mockSession(session: Record<string, unknown>): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(session), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
