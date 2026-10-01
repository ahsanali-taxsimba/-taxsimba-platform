import { z } from "zod";
import { requireUser, getAccountContext } from "@/lib/auth";
import { createApiKey, createReport } from "@/server/services/platform.service";
import { prisma } from "@taxotools/database";
import { jsonError, jsonOk } from "@/server/http";

export async function GET() {
  try {
    const user = await requireUser();
    const account = await getAccountContext(user.id);
    if (!account) return jsonOk({ apiKeys: [], reports: [] });

    const [apiKeys, reports] = await Promise.all([
      prisma.apiKey.findMany({
        where: { accountId: account.id, revokedAt: null },
        select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
      }),
      prisma.report.findMany({
        where: { workspaceId: { in: account.workspaces.map((w) => w.id) } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return jsonOk({ apiKeys, reports });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const account = await getAccountContext(user.id);
    if (!account) throw new Error("Account required");

    const body = z
      .object({
        action: z.enum(["api-key", "report"]),
        name: z.string().optional(),
        workspaceId: z.string().optional(),
        siteId: z.string().optional(),
        title: z.string().optional(),
        whiteLabel: z.boolean().optional(),
      })
      .parse(await req.json());

    if (body.action === "api-key") {
      if (!account.subscription?.plan.apiAccess) {
        return jsonError(new Error("API access requires Agency or Enterprise plan"));
      }
      const created = await createApiKey({
        userId: user.id,
        accountId: account.id,
        name: body.name || "Default key",
      });
      return jsonOk({ apiKey: created }, 201);
    }

    const workspaceId = body.workspaceId || account.workspaces[0]?.id;
    if (!workspaceId) throw new Error("Workspace required");
    const report = await createReport({
      userId: user.id,
      workspaceId,
      siteId: body.siteId,
      title: body.title || "SEO Report",
      whiteLabel: body.whiteLabel,
    });
    return jsonOk({ report }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
