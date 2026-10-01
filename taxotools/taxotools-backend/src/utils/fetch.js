import fetch from "node-fetch";
import { env } from "./env.js";
import { logger, sleep } from "./logger.js";

const log = logger("fetch");

export async function fetchText(url, options = {}) {
  const {
    retries = 2,
    timeoutMs = 20000,
    headers = {},
    method = "GET",
    body,
  } = options;

  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        body,
        signal: ctrl.signal,
        headers: {
          "User-Agent": env.userAgent,
          Accept: "*/*",
          ...headers,
        },
        redirect: "follow",
      });
      clearTimeout(t);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${url} ${text.slice(0, 120)}`);
      }
      return {
        url: res.url,
        status: res.status,
        headers: res.headers,
        text: await res.text(),
      };
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      log.warn(`fetch failed attempt=${i + 1}`, { url, error: String(e.message || e) });
      await sleep(env.crawlDelayMs * (i + 1));
    }
  }
  throw lastErr;
}

export async function fetchJson(url, options = {}) {
  const res = await fetchText(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  return JSON.parse(res.text);
}
