/**
 * Render email previews for UAT evidence (verification, SA purchase, MTD purchase).
 * Run: npx ts-node --transpile-only scripts/renderEmailPreviews.ts
 * Writes HTML under /opt/cursor/artifacts/ when available, else ./tmp-email-previews/
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

process.env.APP_BASE_URL = process.env.APP_BASE_URL || "https://taxsimba.co.uk";

async function main(): Promise<void> {
  const { renderEmail } = await import("../src/services/email");
  const { buildPurchaseConfirmationContent } = await import(
    "../src/services/purchaseConfirmationEmail"
  );

  const outDir =
    process.env.EMAIL_PREVIEW_DIR ||
    (process.env.HOME ? "/opt/cursor/artifacts" : join(process.cwd(), "tmp-email-previews"));
  mkdirSync(outDir, { recursive: true });

  const verification = renderEmail({
    recipientName: "Amara",
    subject: "Verify your email address | TaxSimba",
    title: "Verify your TaxSimba account",
    body:
      "Please verify your email address to confirm your TaxSimba account.\n\n" +
      "This email only verifies your account. It does not activate a package, confirm a purchase, or start a subscription.\n\n" +
      "After you verify, you can continue setting up your chosen tax service and complete purchase when you are ready.\n\n" +
      "If you didn't create a TaxSimba account, you can safely ignore this email.\n\n" +
      "Never share your TaxSimba password or verification link with anyone.",
    link: `${process.env.APP_BASE_URL}/verify-email?token=preview-token`,
    callToAction: "Verify my email",
    preheader: "Verify your TaxSimba account email address",
  });

  const saContent = buildPurchaseConfirmationContent({
    firstName: "Sara",
    serviceType: "SELF_ASSESSMENT",
    packageName: "Tax Simba Simple",
    amount: 119,
    billingType: "ONE_OFF",
    billingFrequency: "Per tax year",
    sessionId: "preview-sa",
    activationAt: "2026-09-24T12:00:00.000Z",
  });
  const sa = renderEmail({
    recipientName: saContent.firstName,
    subject: saContent.subject,
    title: saContent.title,
    body: saContent.body,
    link: saContent.dashboardPath,
    callToAction: saContent.callToAction,
    preheader: saContent.preheader,
  });

  const mtdContent = buildPurchaseConfirmationContent({
    firstName: "Amara",
    serviceType: "MTD_INCOME_TAX",
    packageName: "Simbian Growth",
    amount: 59.99,
    billingType: "RECURRING",
    billingFrequency: "Monthly",
    sessionId: "preview-mtd",
    activationAt: "2026-09-24T12:00:00.000Z",
  });
  const mtd = renderEmail({
    recipientName: mtdContent.firstName,
    subject: mtdContent.subject,
    title: mtdContent.title,
    body: mtdContent.body,
    link: mtdContent.dashboardPath,
    callToAction: mtdContent.callToAction,
    preheader: mtdContent.preheader,
  });

  const files: Record<string, { html: string; text: string }> = {
    "email_preview_verification.html": verification,
    "email_preview_sa_purchase.html": sa,
    "email_preview_mtd_purchase.html": mtd,
  };

  for (const [name, rendered] of Object.entries(files)) {
    const path = join(outDir, name);
    writeFileSync(path, rendered.html, "utf8");
    writeFileSync(path.replace(/\.html$/, ".txt"), rendered.text, "utf8");
    // eslint-disable-next-line no-console
    console.log("WROTE", path);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
