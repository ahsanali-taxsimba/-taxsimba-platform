import Link from "next/link";
import { TOOLKIT_GROUPS } from "@taxotools/shared";

export function SiteToolkitNav({ siteId }: { siteId: string }) {
  return (
    <div className="space-y-4">
      {TOOLKIT_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            {group.name}
          </p>
          <ul className="space-y-0.5">
            {group.tools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/app/sites/${siteId}/tools/${tool.path}`}
                  className="block rounded-md px-2 py-1 text-[12px] text-ink-700 hover:bg-accent-soft hover:text-accent-dark"
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
