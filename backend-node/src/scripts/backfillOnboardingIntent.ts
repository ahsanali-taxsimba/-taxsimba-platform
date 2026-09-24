/**
 * Operator-only backfill for clients.onboarding_intent.
 * Does NOT run on application boot. Never invents MTD without evidence.
 *
 * Rules:
 * - Skip rows that already have onboarding_intent set.
 * - If ACTIVE MTD only → leave intent unset (do not invent PENDING_MTD for history).
 * - If ACTIVE SA only / both → leave intent unset (entitlements already tell the story).
 * - Optional --set-default-sa applies SELF_ASSESSMENT only when intent is missing AND
 *   there is no ACTIVE MTD (safe SA-first default for blank historical rows).
 *
 * Usage:
 *   SEED_DEMO_DATA=false MONGO_URL=... DB_NAME=... \
 *     npx ts-node src/scripts/backfillOnboardingIntent.ts --dry-run
 *   SEED_DEMO_DATA=false MONGO_URL=... DB_NAME=... \
 *     npx ts-node src/scripts/backfillOnboardingIntent.ts --apply --set-default-sa
 */
import { connect, close, col, Doc } from "../db/mongo";
import { SELF_ASSESSMENT } from "../services/clientServices";
import { nowIso } from "../domain/workflow";

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
  const setDefaultSa = args.has("--set-default-sa");

  await connect();
  const clients = (await col("clients").find({}).limit(5000).toArray()) as Doc[];
  let scanned = 0;
  let wouldSetSa = 0;
  let skippedHasIntent = 0;
  let skippedHasActiveMtd = 0;
  let skippedNoDefaultFlag = 0;
  const report: Array<Record<string, unknown>> = [];

  for (const client of clients) {
    scanned += 1;
    if (client.onboarding_intent != null && String(client.onboarding_intent).trim() !== "") {
      skippedHasIntent += 1;
      continue;
    }
    const activeMtd = await col("client_services").findOne({
      client_id: client.id,
      service_type: "MTD_INCOME_TAX",
      status: "ACTIVE",
    });
    if (activeMtd) {
      // Do not classify historical users as MTD intent without signup evidence.
      skippedHasActiveMtd += 1;
      report.push({
        action: "skip_active_mtd_no_invent",
        client_id: client.id,
        email: client.email,
      });
      continue;
    }
    if (!setDefaultSa) {
      skippedNoDefaultFlag += 1;
      report.push({
        action: "skip_needs_set_default_sa_flag",
        client_id: client.id,
        email: client.email,
      });
      continue;
    }
    wouldSetSa += 1;
    report.push({
      action: dryRun ? "would_set_self_assessment" : "set_self_assessment",
      client_id: client.id,
      email: client.email,
    });
    if (!dryRun) {
      await col("clients").updateOne(
        { id: client.id },
        { $set: { onboarding_intent: SELF_ASSESSMENT, updated_at: nowIso() } },
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: dryRun ? "dry-run" : "apply",
        setDefaultSa,
        scanned,
        wouldSetSa,
        skippedHasIntent,
        skippedHasActiveMtd,
        skippedNoDefaultFlag,
        note: "Boot does not run this. Never invents MTD intent.",
        report: report.slice(0, 200),
        reportTruncated: report.length > 200,
      },
      null,
      2,
    ),
  );
  await close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
