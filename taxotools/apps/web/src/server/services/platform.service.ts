import { prisma, type Prisma } from "@taxotools/database";
import { getSiteForUser, assertWorkspaceAccess } from "@/server/services/tenant.service";
import { enqueueJob } from "@/server/queue";
import crypto from "crypto";

export async function createReport(params: {
  userId: string;
  workspaceId: string;
  siteId?: string;
  title: string;
  whiteLabel?: boolean;
}) {
  await assertWorkspaceAccess(params.userId, params.workspaceId);
  if (params.siteId) await getSiteForUser(params.userId, params.siteId);

  const report = await prisma.report.create({
    data: {
      workspaceId: params.workspaceId,
      siteId: params.siteId,
      title: params.title,
      status: "QUEUED",
      whiteLabel: params.whiteLabel ?? false,
      format: "HTML",
    },
  });

  await enqueueJob({
    queue: "taxotools-report",
    name: "generate-report",
    payload: { reportId: report.id },
  });

  return report;
}

export async function createApiKey(params: {
  userId: string;
  accountId: string;
  name: string;
}) {
  const raw = `tt_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const keyPrefix = raw.slice(0, 10);

  const record = await prisma.apiKey.create({
    data: {
      accountId: params.accountId,
      userId: params.userId,
      name: params.name,
      keyHash,
      keyPrefix,
    },
  });

  return { ...record, key: raw };
}

export async function writeAuditLog(params: {
  accountId: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      accountId: params.accountId,
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
