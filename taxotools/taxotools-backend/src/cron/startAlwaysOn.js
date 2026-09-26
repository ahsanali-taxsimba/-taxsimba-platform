/**
 * Always-on process: HTTP API + continuous crawler in one Node process.
 * Deploy THIS on Render/Railway/Fly so crawling survives closing Cursor.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../utils/logger.js";

const log = logger("alwaysOn");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const children = new Map();

function start(name, scriptRel) {
  const script = path.join(root, scriptRel);
  const child = spawn(process.execPath, [script], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  children.set(name, child);
  log.info(`started ${name}`, { pid: child.pid, script: scriptRel });

  child.on("exit", (code, signal) => {
    log.warn(`${name} exited — restarting in 5s`, { code, signal });
    children.delete(name);
    setTimeout(() => start(name, scriptRel), 5000);
  });
}

function shutdown(sig) {
  log.info(`shutting down (${sig})`);
  for (const [, child] of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start("api", "src/api/server.js");
start("continuous", "src/cron/continuous.js");

log.info("Always-on TaxoTools crawler + API is running");
