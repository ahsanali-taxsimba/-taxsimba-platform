import { redirect } from "next/navigation";
import { requireUser, getAccountContext } from "@/lib/auth";
import { prisma } from "@taxotools/database";
import { usageSummary } from "@/server/services/usage.service";

export default async function SettingsPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const account = await getAccountContext(user.id);
  if (!account) redirect("/onboarding");

  const [usage, apiKeys, members] = await Promise.all([
    usageSummary(account.id),
    prisma.apiKey.findMany({
      where: { accountId: account.id, revokedAt: null },
      select: { id: true, name: true, keyPrefix: true, createdAt: true },
    }),
    prisma.workspaceMember.findMany({
      where: { workspace: { accountId: account.id } },
      include: { user: { select: { email: true, name: true } }, workspace: true },
    }),
  ]);

  return (
    <div className="animate-rise space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-ink-500">Team, usage, and API keys</p>
      </div>

      <section className="rounded-xl border border-ink-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Account</h2>
        <p className="mt-2 text-sm text-ink-500">
          {account.name} · slug `{account.slug}` · plan {account.subscription?.plan.code}
        </p>
      </section>

      <section className="rounded-xl border border-ink-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Usage ({usage.period})</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {usage.items.map((i) => (
            <li key={i.metric} className="text-sm text-ink-700">
              {i.metric}: {i.used}/{i.limit < 0 ? "∞" : i.limit}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-ink-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Team</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {members.map((m) => (
            <li key={m.id}>
              {m.user.name || m.user.email} · {m.role} · {m.workspace.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-ink-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold">API keys</h2>
        <p className="mt-1 text-sm text-ink-500">
          Agency+ plans. Create via POST /api/settings {`{ action: "api-key" }`}
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {apiKeys.map((k) => (
            <li key={k.id}>
              {k.name} · {k.keyPrefix}… · {new Date(k.createdAt).toLocaleDateString()}
            </li>
          ))}
          {!apiKeys.length && <li className="text-ink-500">No keys yet</li>}
        </ul>
      </section>
    </div>
  );
}
