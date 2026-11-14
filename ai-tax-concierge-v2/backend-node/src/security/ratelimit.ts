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

export const chatLimiter = new RateLimiter(40, 60.0);
