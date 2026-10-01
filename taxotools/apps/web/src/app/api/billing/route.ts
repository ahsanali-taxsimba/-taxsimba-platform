import { requireUser, getAccountContext } from "@/lib/auth";
import { usageSummary } from "@/server/services/usage.service";
import { prisma } from "@taxotools/database";
import { jsonError, jsonOk } from "@/server/http";

export async function GET() {
  try {
    const user = await requireUser();
    const account = await getAccountContext(user.id);
    if (!account) return jsonOk({ plans: await prisma.plan.findMany({ where: { active: true } }) });

    const [usage, plans] = await Promise.all([
      usageSummary(account.id),
      prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPriceCents: "asc" } }),
    ]);

    return jsonOk({
      subscription: account.subscription,
      usage,
      plans,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const account = await getAccountContext(user.id);
    if (!account) throw new Error("Account required");

    const { planCode } = (await req.json()) as { planCode?: string };
    if (!planCode) throw new Error("planCode required");

    const plan = await prisma.plan.findUnique({ where: { code: planCode as never } });
    if (!plan) throw new Error("Plan not found");

    // Stripe Checkout would be created here when keys are configured.
    // For local/dev we update subscription directly to keep the billing model testable.
    if (!process.env.STRIPE_SECRET_KEY) {
      const sub = await prisma.subscription.update({
        where: { accountId: account.id },
        data: {
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        include: { plan: true },
      });
      return jsonOk({ mode: "direct", subscription: sub });
    }

    return jsonOk({
      mode: "stripe",
      message: "Create Stripe Checkout Session with STRIPE_PRICE_* env vars",
      plan,
    });
  } catch (err) {
    return jsonError(err);
  }
}
