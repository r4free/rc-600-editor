import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AiRateLimiter } from "./ai-rate-limit";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function request(ip = "203.0.113.10"): Request {
  return new Request("https://rc-600-editor.onrender.com/api/setlists/chart/generate", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("AI production rate limit", () => {
  it("is unlimited outside production by default", () => {
    delete process.env.NODE_ENV;
    delete process.env.RENDER;
    delete process.env.AI_LIMIT_ENABLED;
    const status = new AiRateLimiter().consume(request(), 1_000);
    assert.equal(status.allowed, true);
    assert.equal(status.unlimited, true);
  });

  it("uses the VG editor production minute and daily guards", () => {
    process.env.NODE_ENV = "production";
    process.env.AI_LIMIT_PER_IP_MINUTE = "2";
    process.env.AI_LIMIT_PER_IP_DAY = "10";
    const limiter = new AiRateLimiter();
    assert.equal(limiter.consume(request(), 1_000).allowed, true);
    assert.equal(limiter.consume(request(), 2_000).allowed, true);
    const blocked = limiter.consume(request(), 3_000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.scope, "ip-minute");
  });

  it("tracks different client IPs independently", () => {
    process.env.NODE_ENV = "production";
    process.env.AI_LIMIT_PER_IP_MINUTE = "1";
    const limiter = new AiRateLimiter();
    assert.equal(limiter.consume(request("203.0.113.1"), 1_000).allowed, true);
    assert.equal(limiter.consume(request("203.0.113.2"), 1_000).allowed, true);
  });
});
