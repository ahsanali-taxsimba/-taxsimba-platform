import { env } from "./env.js";

const levels = { debug: 10, info: 20, warn: 30, error: 40 };

export function logger(scope = "backend") {
  const min = levels[process.env.LOG_LEVEL || "info"] ?? 20;
  const line = (level, msg, meta) => {
    if ((levels[level] ?? 99) < min) return;
    const payload = meta ? ` ${JSON.stringify(meta)}` : "";
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](
      `[${new Date().toISOString()}] [${scope}] ${msg}${payload}`,
    );
  };
  return {
    debug: (m, meta) => line("debug", m, meta),
    info: (m, meta) => line("info", m, meta),
    warn: (m, meta) => line("warn", m, meta),
    error: (m, meta) => line("error", m, meta),
  };
}

export async function sleep(ms = env.crawlDelayMs) {
  await new Promise((r) => setTimeout(r, ms));
}
