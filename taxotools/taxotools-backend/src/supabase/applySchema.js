import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

const log = logger("applySchema");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!env.databaseUrl) {
    throw new Error("DIRECT_URL or DATABASE_URL required to apply schema");
  }
  // Strip pgbouncer query for raw SQL if present on transaction URL — prefer DIRECT_URL
  const url = env.databaseUrl;
  const sqlPath = path.resolve(__dirname, "../../supabase-schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    log.info("Schema applied successfully");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  log.error(e.message || String(e));
  process.exit(1);
});
