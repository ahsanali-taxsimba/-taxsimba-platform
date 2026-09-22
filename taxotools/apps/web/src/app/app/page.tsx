import { redirect } from "next/navigation";
import { requireUser, getAccountContext } from "@/lib/auth";
import { listSitesForUser } from "@/server/services/tenant.service";
import { usageSummary } from "@/server/services/usage.service";
import { DashboardMotion } from "@/components/DashboardMotion";

export default async function AppDashboardPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const [account, sites] = await Promise.all([
    getAccountContext(user.id),
    listSitesForUser(user.id),
  ]);

  if (!account) redirect("/onboarding");
  if (!sites.length) redirect("/onboarding");

  const usage = await usageSummary(account.id);
  const plan = account.subscription?.plan;

  return (
    <DashboardMotion
      planName={plan?.name}
      siteCount={sites.length}
      usageItems={usage.items.filter((i) =>
        ["SITES", "KEYWORDS", "CRAWLS", "AEO_SCANS"].includes(i.metric),
      )}
      sites={sites}
    />
  );
}
