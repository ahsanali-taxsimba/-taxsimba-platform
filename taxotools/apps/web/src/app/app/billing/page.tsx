import { redirect } from "next/navigation";
import { requireUser, getAccountContext } from "@/lib/auth";
import { prisma } from "@taxotools/database";
import { BillingPanel } from "@/components/BillingPanel";

export default async function BillingPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const account = await getAccountContext(user.id);
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { monthlyPriceCents: "asc" },
  });

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Billing</h1>
        <p className="text-ink-500">
          Flexible plan limits — Stripe Checkout when keys are configured
        </p>
      </div>
      <BillingPanel
        currentPlanCode={account?.subscription?.plan.code ?? "STARTER"}
        plans={plans.map((p) => ({
          code: p.code,
          name: p.name,
          monthlyPriceCents: p.monthlyPriceCents,
          sitesLimit: p.sitesLimit,
          keywordsLimit: p.keywordsLimit,
          aiCreditsPerMonth: p.aiCreditsPerMonth,
          aeoScansPerMonth: p.aeoScansPerMonth,
          whiteLabel: p.whiteLabel,
          apiAccess: p.apiAccess,
        }))}
      />
    </div>
  );
}
