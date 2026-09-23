import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listSitesForUser } from "@/server/services/tenant.service";
import { TOOLKIT_GROUPS, ALL_TOOL_IDS } from "@taxotools/shared";

export default async function ToolkitsHubPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const sites = await listSitesForUser(user.id);
  const primary = sites[0];

  return (
    <div className="animate-rise space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Toolkits</h1>
        <p className="text-ink-500">
          Semrush + Search Atlas competitive toolkits — Taxo Agent autopilot, Content Genius,
          Smart Ads, and full SEO/AEO suites. {ALL_TOOL_IDS.length} tools available.
        </p>
      </div>

      {!primary && (
        <p className="text-sm text-ink-500">
          Add a site first to run tools.{" "}
          <Link href="/onboarding" className="text-accent-dark">
            Onboarding
          </Link>
        </p>
      )}

      {TOOLKIT_GROUPS.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{group.name}</h2>
            <p className="text-sm text-ink-500">{group.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => (
              <div key={tool.id} className="rounded-xl border border-ink-100 bg-white p-4">
                <p className="font-medium">{tool.name}</p>
                {primary ? (
                  <Link
                    href={`/app/sites/${primary.id}/tools/${tool.path}`}
                    className="mt-2 inline-block text-sm text-accent-dark"
                  >
                    Open on {primary.domain} →
                  </Link>
                ) : (
                  <p className="mt-2 text-sm text-ink-500">Requires a site</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
