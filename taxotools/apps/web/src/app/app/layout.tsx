import { redirect } from "next/navigation";
import { requireUser, getAccountContext, clearSessionCookie } from "@/lib/auth";
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
  const account = await getAccountContext(user.id);

  return (
    <AppChrome accountName={account?.name} email={user.email} signOutAction={signOut}>
      {children}
    </AppChrome>
  );
}
