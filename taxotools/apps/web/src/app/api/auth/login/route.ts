import { z } from "zod";
import { prisma } from "@taxotools/database";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
  clearSessionCookie,
} from "@/lib/auth";
import { jsonError, jsonOk } from "@/server/http";
import { AuthError } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user?.passwordHash) throw new AuthError("Invalid credentials");
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) throw new AuthError("Invalid credentials");

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);
    return jsonOk({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}
