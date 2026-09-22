import { redirect } from "next/navigation";
import { requireUser, getAccountContext, clearSessionCookie } from "@/lib/auth";
import { listSitesForUser } from "@/server/services/tenant.service";
import { AppChrome } from "@/components/AppChrome";

async function signOut() {
  "use server";
  await clearSessionCookie();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
  const primary = sites[0];

  return (
    <AppChrome
      accountName={account?.name}
      email={user.email}
      primarySiteId={primary?.id}
      primarySiteDomain={primary?.domain}
      signOutAction={signOut}
    >
      {children}
    </AppChrome>
  );
}
