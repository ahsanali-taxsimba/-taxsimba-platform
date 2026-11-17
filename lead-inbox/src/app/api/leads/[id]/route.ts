import { requireViewer } from "@/lib/auth";
import { deleteLead, getLead, isLeadStatus, updateLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await ctx.params;

  const lead = await getLead(viewer.sub, id);
  if (!lead) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json(
    { lead },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function PATCH(request: Request, ctx: Ctx) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.status !== undefined && !isLeadStatus(body.status)) {
    return Response.json({ error: "invalid_status" }, { status: 400 });
  }

  const lead = await updateLead(viewer.sub, id, {
    status: isLeadStatus(body.status) ? body.status : undefined,
    name: typeof body.name === "string" ? body.name : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    company: typeof body.company === "string" ? body.company : undefined,
    subject: typeof body.subject === "string" ? body.subject : undefined,
    message: typeof body.message === "string" ? body.message : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  if (!lead) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json(
    { lead },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function DELETE(request: Request, ctx: Ctx) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await ctx.params;

  const ok = await deleteLead(viewer.sub, id);
  if (!ok) return Response.json({ error: "not_found" }, { status: 404 });

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "private, no-store" },
  });
}
