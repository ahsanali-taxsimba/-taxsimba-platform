import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, getAccountContext, clearSessionCookie } from "@/lib/auth";

const nav = [
  { href: "/app", label: "Overview" },
  { href: "/app/sites", label: "Sites" },
  { href: "/app/toolkits", label: "Toolkits" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
];

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
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-60 shrink-0 border-r border-ink-100 bg-white px-4 py-6 md:block">
          <Link href="/app" className="font-display text-xl font-semibold text-ink-950">
            Taxotools
          </Link>
          <p className="mt-1 truncate text-xs text-ink-500">{account?.name}</p>
          <nav className="mt-8 space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-accent-soft hover:text-accent-dark"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="mt-10">
            <button type="submit" className="text-left text-sm text-ink-500 hover:text-danger">
              Sign out
            </button>
          </form>
        </aside>
        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-ink-100 bg-white/80 px-6 py-4 backdrop-blur md:px-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Signed in as</p>
              <p className="text-sm font-medium text-ink-900">{user.email}</p>
            </div>
            <Link
              href="/onboarding"
              className="rounded-lg border border-ink-100 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
            >
              Add site
            </Link>
          </header>
          <div className="px-6 py-8 md:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
