import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Reuse one client across warm serverless invocations. */
export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export default prisma;
