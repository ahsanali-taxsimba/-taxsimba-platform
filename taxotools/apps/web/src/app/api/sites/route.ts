import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSite, listSitesForUser } from "@/server/services/tenant.service";
import { writeAuditLog } from "@/server/services/platform.service";
import { prisma } from "@taxotools/database";
import { jsonError, jsonOk } from "@/server/http";

export async function GET() {
  try {
    const user = await requireUser();
    const sites = await listSitesForUser(user.id);
    return jsonOk({ sites });
  } catch (err) {
    return jsonError(err);
  }
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  url: z.string().min(1),
  locale: z.string().optional(),
  countryCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());
    const site = await createSite({ userId: user.id, ...body });
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: body.workspaceId },
    });
    await writeAuditLog({
      accountId: workspace.accountId,
      userId: user.id,
      action: "site.create",
      resource: "site",
      resourceId: site.id,
    });
    return jsonOk({ site }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
