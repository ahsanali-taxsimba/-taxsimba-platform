import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@taxotools/database";
import bcrypt from "bcryptjs";

const COOKIE = "taxotools_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-taxotools-secret";
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  email: string;
  name?: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ email: payload.email, name: payload.name ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new AuthError("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) throw new AuthError("Unauthorized");
  return user;
}

export async function getAccountContext(userId: string) {
  const account = await prisma.account.findUnique({
    where: { ownerId: userId },
    include: {
      subscription: { include: { plan: true } },
      workspaces: {
        include: {
          members: true,
          sites: { take: 20, orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return account;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class LimitError extends Error {
  status = 402;
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}
