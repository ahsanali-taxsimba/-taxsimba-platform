/**
 * Staging-safe package catalogue reconciliation.
 * Does not modify production automatically — run explicitly against staging Mongo.
 *
 * Usage:
 *   SEED_DEMO_DATA=false MONGO_URL=... DB_NAME=... npx ts-node src/scripts/reconcilePackages.ts
 */
import { connect, close } from "../db/mongo";
import { reconcilePackageCatalogue } from "../domain/packages";

async function main() {
  await connect();
  const result = await reconcilePackageCatalogue();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  await close();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  try {
    await close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
