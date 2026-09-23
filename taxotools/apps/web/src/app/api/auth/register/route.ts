import { z } from "zod";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  verifyPassword,
  clearSessionCookie,
  getSession,
} from "@/lib/auth";
import { prisma } from "@taxotools/database";
import { createAccountWithWorkspace } from "@/server/services/tenant.service";
import { jsonError, jsonOk } from "@/server/http";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80),
  accountName: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return jsonError(new Error("Email already registered"));

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash: await hashPassword(body.password),
        emailVerified: new Date(),
      },
    });

    await createAccountWithWorkspace({
      userId: user.id,
      accountName: body.accountName || `${body.name}'s Account`,
      workspaceName: "Main Workspace",
    });

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);

    return jsonOk({ id: user.id, email: user.email, name: user.name }, 201);
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return jsonOk({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, image: true },
  });
  return jsonOk({ user });
}

export async function DELETE() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}
