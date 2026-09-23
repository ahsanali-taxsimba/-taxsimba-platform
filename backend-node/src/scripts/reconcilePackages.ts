/**
 * Explicit package catalogue reconciliation for staging / authorised operators.
 * Does NOT run on application boot. Never modifies production unless the operator
 * points MONGO_URL/DB_NAME at that database deliberately.
 *
 * Usage (staging example):
 *   SEED_DEMO_DATA=false NODE_ENV=production \
 *   MONGO_URL=... DB_NAME=... \
 *   npx ts-node src/scripts/reconcilePackages.ts
 */
import { connect, close } from "../db/mongo";
import { reconcilePackageCatalogue } from "../domain/packages";

async function main() {
  const result = await (async () => {
    await connect();
    return reconcilePackageCatalogue();
  })();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "explicit-operator-reconciliation",
        note: "Boot does not run this automatically in production/staging.",
        ...result,
      },
      null,
      2,
    ),
  );
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
