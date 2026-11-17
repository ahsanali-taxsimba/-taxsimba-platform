import { requireViewer } from "@/lib/auth";
import { seedSampleLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const inserted = await seedSampleLeads(viewer.sub);
  return Response.json(
    { inserted },
    { headers: { "cache-control": "private, no-store" } },
  );
}
