/** Simple in-memory rate limiter for chat endpoints. */

import { ConciergeError } from "../core/errors.js";

export class RateLimiter {
  readonly maxCalls: number;
  readonly window: number;
  private readonly hits = new Map<string, number[]>();

  constructor(maxCalls = 30, windowSeconds = 60.0) {
    this.maxCalls = maxCalls;
    this.window = windowSeconds;
  }

  check(key: string): void {
    const now = performance.now() / 1000;
    let q = this.hits.get(key);
    if (!q) {
      q = [];
      this.hits.set(key, q);
    }
    while (q.length && now - q[0]! > this.window) {
      q.shift();
    }
    if (q.length >= this.maxCalls) {
      throw new ConciergeError(
        "Too many requests. Please wait a moment and try again.",
        { code: "rate_limited", statusCode: 429 },
      );
    }
    q.push(now);
  }
}

/** Allow long continuous conversations (20–50 turns) without arbitrary stalls.
 * Eval / proof packs may raise CONCIERGE_CHAT_RATE_MAX to avoid false 429s. */
export const chatLimiter = new RateLimiter(
  Number(process.env.CONCIERGE_CHAT_RATE_MAX || 90),
  Number(process.env.CONCIERGE_CHAT_RATE_WINDOW || 60),
);
/** Slightly stricter public catalogue/bootstrap limiter. */
export const publicApiLimiter = new RateLimiter(
  Number(process.env.CONCIERGE_PUBLIC_RATE_MAX || 120),
  Number(process.env.CONCIERGE_PUBLIC_RATE_WINDOW || 60),
);
