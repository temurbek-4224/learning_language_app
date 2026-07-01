import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "wordxotira_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  role: UserRole;
  exp: number;
};

export type AuthUser = {
  id: string;
  login: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to at least 16 characters.");
  }

  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function createSessionToken(payload: SessionPayload) {
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = sign(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as SessionPayload;

    if (!payload.userId || !payload.role || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, role: UserRole) {
  const cookieStore = await cookies();
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;

  cookieStore.set(SESSION_COOKIE, createSessionToken({ userId, role, exp }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.webUser.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      login: true,
      fullName: true,
      role: true,
      status: true,
    },
  });

  if (!user || user.role !== payload.role || user.status !== UserStatus.ACTIVE) {
    return null;
  }

  return user;
}

export async function requireRole(role: UserRole, loginPath: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginPath);
  }

  if (user.role !== role) {
    if (user.role === UserRole.SUPER_ADMIN) {
      redirect("/admin");
    }

    if (user.role === UserRole.TEACHER) {
      redirect("/teacher");
    }

    redirect(loginPath);
  }

  return user;
}

export async function loginWithPassword(
  login: string,
  password: string,
  expectedRole: UserRole,
) {
  const normalizedLogin = login.trim().toLowerCase();

  if (!normalizedLogin || !password) {
    return { ok: false, error: "Login and password are required." };
  }

  const user = await prisma.webUser.findUnique({
    where: { login: normalizedLogin },
  });

  if (!user || user.role !== expectedRole || !user.passwordHash) {
    return { ok: false, error: "Invalid login or password." };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { ok: false, error: "This account is inactive or blocked." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return { ok: false, error: "Invalid login or password." };
  }

  await createSession(user.id, user.role);
  return { ok: true };
}

export async function logout() {
  await clearSession();
}
