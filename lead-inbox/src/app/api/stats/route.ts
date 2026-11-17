import { requireViewer } from "@/lib/auth";
import { leadStats, recentIngest } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const [stats, events] = await Promise.all([
    leadStats(viewer.sub),
    recentIngest(viewer.sub, 12),
  ]);

  return Response.json(
    { stats, events },
    { headers: { "cache-control": "private, no-store" } },
  );
}
