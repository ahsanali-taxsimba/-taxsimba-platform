import { requireViewer } from "@/lib/auth";
import { usingSampleDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  return Response.json(
    {
      name: viewer.name,
      email: viewer.email,
      sampleDatabase: usingSampleDatabase(),
      simulated: !process.env.CURSOR_APP_ID,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
