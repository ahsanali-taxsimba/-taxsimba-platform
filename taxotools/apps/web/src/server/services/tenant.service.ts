import { prisma } from "@taxotools/database";
import { slugify, domainFromUrl } from "@/lib/utils";
import { assertWithinLimit } from "@/server/services/usage.service";
import { ForbiddenError } from "@/lib/auth";

export async function createAccountWithWorkspace(params: {
  userId: string;
  accountName: string;
  workspaceName: string;
}) {
  const existing = await prisma.account.findUnique({ where: { ownerId: params.userId } });
  if (existing) return existing;

  const starter = await prisma.plan.findUniqueOrThrow({ where: { code: "STARTER" } });
  const accountSlug = slugify(params.accountName) || `acct-${params.userId.slice(-6)}`;
  const workspaceSlug = slugify(params.workspaceName) || "main";

  return prisma.account.create({
    data: {
      name: params.accountName,
      slug: accountSlug,
      ownerId: params.userId,
      subscription: {
        create: {
          planId: starter.id,
          status: "TRIALING",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      },
      workspaces: {
        create: {
          name: params.workspaceName,
          slug: workspaceSlug,
          members: {
            create: { userId: params.userId, role: "OWNER" },
          },
        },
      },
    },
    include: { workspaces: true, subscription: { include: { plan: true } } },
  });
}

export async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { include: { account: true } } },
  });
  if (!member) throw new ForbiddenError("No access to workspace");
  return member;
}

export async function createSite(params: {
  userId: string;
  workspaceId: string;
  name: string;
  url: string;
  locale?: string;
  countryCode?: string;
}) {
  const member = await assertWorkspaceAccess(params.userId, params.workspaceId);
  await assertWithinLimit(member.workspace.accountId, "SITES", 1);

  const domain = domainFromUrl(params.url);
  const url = params.url.startsWith("http") ? params.url : `https://${params.url}`;

  return prisma.site.create({
    data: {
      workspaceId: params.workspaceId,
      name: params.name,
      domain,
      url,
      locale: params.locale ?? "en-US",
      countryCode: params.countryCode ?? "US",
    },
  });
}

export async function listSitesForUser(userId: string) {
  return prisma.site.findMany({
    where: { workspace: { members: { some: { userId } } } },
    include: {
      workspace: { select: { id: true, name: true, accountId: true } },
      _count: { select: { keywords: true, crawls: true, pages: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSiteForUser(userId: string, siteId: string) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, workspace: { members: { some: { userId } } } },
    include: {
      workspace: true,
      competitors: true,
      _count: {
        select: {
          keywords: true,
          crawls: true,
          pages: true,
          backlinks: true,
          contentPages: true,
          aiVisibilityRecords: true,
        },
      },
    },
  });
  if (!site) throw new ForbiddenError("Site not found");
  return site;
}
