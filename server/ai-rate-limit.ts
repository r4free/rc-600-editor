const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AiLimitStatus {
  allowed: boolean;
  scope?: "ip-minute" | "ip-day" | "global-day";
  reason?: string;
  retryAfterSec: number;
  remainingToday: number;
  limitPerDay: number;
  globalRemainingToday: number;
  resetAt: string;
  unlimited: boolean;
}

interface Window {
  count: number;
  start: number;
}

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function aiLimitsEnabled(): boolean {
  const override = process.env.AI_LIMIT_ENABLED?.trim().toLowerCase();
  if (["0", "false", "off"].includes(override ?? "")) return false;
  if (["1", "true", "on"].includes(override ?? "")) return true;
  return process.env.RENDER === "true" || process.env.NODE_ENV === "production";
}

function requestIdentity(request: Request): { key: string; local: boolean } {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const key = forwarded || realIp || new URL(request.url).hostname || "unknown";
  const local = !forwarded && !realIp && ["127.0.0.1", "::1", "localhost"].includes(key);
  return { key, local };
}

function currentWindow(window: Window | undefined, now: number, duration: number): Window {
  return !window || now - window.start >= duration ? { count: 0, start: now } : window;
}

export class AiRateLimiter {
  private readonly minute = new Map<string, Window>();
  private readonly day = new Map<string, Window>();
  private globalDay: Window = { count: 0, start: 0 };

  peek(request: Request, now = Date.now()): AiLimitStatus {
    return this.evaluate(request, now, false);
  }

  consume(request: Request, now = Date.now()): AiLimitStatus {
    return this.evaluate(request, now, true);
  }

  private evaluate(request: Request, now: number, consume: boolean): AiLimitStatus {
    const { key, local } = requestIdentity(request);
    const enabled = aiLimitsEnabled();
    const exempt = !enabled || (local && process.env.AI_LIMIT_EXEMPT_LOCALHOST !== "0");
    const minuteLimit = envInt("AI_LIMIT_PER_IP_MINUTE", 3);
    const dayLimit = envInt("AI_LIMIT_PER_IP_DAY", 5);
    const globalLimit = envInt("AI_LIMIT_GLOBAL_DAY", 60);
    const minute = currentWindow(this.minute.get(key), now, MINUTE_MS);
    const day = currentWindow(this.day.get(key), now, DAY_MS);
    const global = currentWindow(this.globalDay, now, DAY_MS);

    const status = (): AiLimitStatus => ({
      allowed: true,
      retryAfterSec: 0,
      remainingToday: dayLimit ? Math.max(0, dayLimit - day.count) : Infinity,
      limitPerDay: dayLimit,
      globalRemainingToday: globalLimit ? Math.max(0, globalLimit - global.count) : Infinity,
      resetAt: new Date(day.start + DAY_MS).toISOString(),
      unlimited: exempt || dayLimit === 0,
    });
    if (exempt) return status();

    if (minuteLimit && minute.count >= minuteLimit) {
      return {
        ...status(),
        allowed: false,
        scope: "ip-minute",
        reason: `Too many generations in a row — limit of ${minuteLimit} per minute. Try again shortly.`,
        retryAfterSec: Math.max(1, Math.ceil((minute.start + MINUTE_MS - now) / 1000)),
      };
    }
    if (dayLimit && day.count >= dayLimit) {
      return {
        ...status(),
        allowed: false,
        scope: "ip-day",
        reason: `Daily limit of ${dayLimit} generations per IP reached. Come back tomorrow or run the project locally with your own key.`,
        retryAfterSec: Math.max(1, Math.ceil((day.start + DAY_MS - now) / 1000)),
      };
    }
    if (globalLimit && global.count >= globalLimit) {
      return {
        ...status(),
        allowed: false,
        scope: "global-day",
        reason: `The demo's shared daily quota (${globalLimit} generations) is used up. Run the project locally with your own key.`,
        retryAfterSec: Math.max(1, Math.ceil((global.start + DAY_MS - now) / 1000)),
      };
    }

    if (consume) {
      minute.count += 1;
      day.count += 1;
      global.count += 1;
      this.minute.set(key, minute);
      this.day.set(key, day);
      this.globalDay = global;
    }
    return status();
  }
}

export function serializeAiLimit(status: AiLimitStatus): Record<string, unknown> {
  const finite = (value: number) => Number.isFinite(value) ? value : null;
  return {
    ...status,
    remainingToday: finite(status.remainingToday),
    globalRemainingToday: finite(status.globalRemainingToday),
    limitPerDay: status.limitPerDay || null,
  };
}
