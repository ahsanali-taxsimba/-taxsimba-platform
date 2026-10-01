import { redirect } from "next/navigation";
import { requireUser, getAppShellContext, clearSessionCookie } from "@/lib/auth";
import { AppChrome } from "@/components/AppChrome";

export const preferredRegion = ["lhr1"];
export const dynamic = "force-dynamic";

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

  const account = await getAppShellContext(user.id);
  const primary = account?.workspaces[0]?.sites[0];

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
