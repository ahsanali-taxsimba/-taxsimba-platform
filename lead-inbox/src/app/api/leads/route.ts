import { requireViewer } from "@/lib/auth";
import { createLead, isLeadSource, listLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const url = new URL(request.url);
  const leads = await listLeads(viewer.sub, {
    source: url.searchParams.get("source") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });

  return Response.json(
    { leads },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const source = body.source ?? "manual";
  if (!isLeadSource(source)) {
    return Response.json({ error: "invalid_source" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name && !String(body.email ?? "").trim() && !String(body.phone ?? "").trim()) {
    return Response.json(
      { error: "validation", message: "Provide at least a name, email, or phone." },
      { status: 400 },
    );
  }

  const lead = await createLead(viewer.sub, {
    source,
    name,
    email: typeof body.email === "string" ? body.email : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    company: typeof body.company === "string" ? body.company : "",
    subject: typeof body.subject === "string" ? body.subject : "",
    message: typeof body.message === "string" ? body.message : "",
    notes: typeof body.notes === "string" ? body.notes : "",
  });

  return Response.json(
    { lead },
    { status: 201, headers: { "cache-control": "private, no-store" } },
  );
}
