/**
 * Explicit package catalogue reconciliation for staging / authorised operators.
 * Does NOT run on application boot.
 *
 * Usage:
 *   # Dry-run / report only (no writes):
 *   SEED_DEMO_DATA=false MONGO_URL=... DB_NAME=... \
 *     npx ts-node src/scripts/reconcilePackages.ts --dry-run
 *
 *   # Apply:
 *   SEED_DEMO_DATA=false MONGO_URL=... DB_NAME=... \
 *     npx ts-node src/scripts/reconcilePackages.ts --apply
 */
import { connect, close } from "../db/mongo";
import { reconcilePackageCatalogue } from "../domain/packages";

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run") || args.has("-n") || !args.has("--apply");
  if (!args.has("--dry-run") && !args.has("--apply") && !args.has("-n")) {
    // eslint-disable-next-line no-console
    console.error(
      "Refusing to mutate without an explicit flag. Pass --dry-run (report) or --apply.",
    );
    process.exit(2);
  }

  await connect();
  const result = await reconcilePackageCatalogue({ dryRun });
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: dryRun ? "dry-run" : "apply",
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
