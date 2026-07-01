"use server";

import bcrypt from "bcryptjs";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

function redirectWithError(path: string, error: string) {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

export async function createTeacherAction(formData: FormData) {
  await requireRole(UserRole.SUPER_ADMIN, "/admin/login");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const login = normalizeLogin(String(formData.get("login") ?? ""));
  const password = String(formData.get("password") ?? "");
  const statusInput = String(formData.get("status") ?? UserStatus.ACTIVE);
  const status =
    statusInput === UserStatus.INACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;

  if (!fullName || !login || !password) {
    redirectWithError("/admin/teachers/new", "All fields are required.");
  }

  if (password.length < 8) {
    redirectWithError(
      "/admin/teachers/new",
      "Temporary password must be at least 8 characters.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.webUser.create({
      data: {
        fullName,
        login,
        passwordHash,
        role: UserRole.TEACHER,
        status,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithError("/admin/teachers/new", "Login already exists.");
    }

    throw error;
  }

  redirect("/admin/teachers");
}

export async function resetTeacherPasswordAction(formData: FormData) {
  await requireRole(UserRole.SUPER_ADMIN, "/admin/login");

  const teacherId = String(formData.get("teacherId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!teacherId || !password) {
    redirectWithError("/admin/teachers", "Teacher and new password are required.");
  }

  if (password.length < 8) {
    redirectWithError(
      "/admin/teachers",
      "New temporary password must be at least 8 characters.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.webUser.updateMany({
    where: {
      id: teacherId,
      role: UserRole.TEACHER,
    },
    data: { passwordHash },
  });

  redirect("/admin/teachers?success=Password%20reset%20saved.");
}
