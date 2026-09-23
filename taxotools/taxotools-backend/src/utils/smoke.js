import { getSupabase } from "../supabase/client.js";
import { logger } from "../utils/logger.js";
import { env, assertSupabase } from "../utils/env.js";
import { seedDemoFirms } from "../discovery/companiesHouse.js";
import { listAccountancyFirms } from "../supabase/insertDomain.js";

const log = logger("smoke");

async function main() {
  assertSupabase();
  log.info("Supabase OK", { url: env.supabaseUrl });
  const { error } = await getSupabase().from("accountancy_firms").select("id").limit(1);
  if (error) throw error;
  let firms = await listAccountancyFirms({ limit: 5 });
  if (!firms.length) {
    await seedDemoFirms("smoke");
    firms = await listAccountancyFirms({ limit: 5 });
  }
  log.info(`Firms in DB: ${firms.length}`);
  console.log(JSON.stringify({ ok: true, firms: firms.map((f) => f.domain) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
