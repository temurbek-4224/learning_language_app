"use server";

import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

import { loginWithPassword } from "@/lib/auth";

export async function adminLoginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await loginWithPassword(login, password, UserRole.SUPER_ADMIN);

  if (!result.ok) {
    redirect(
      `/admin/login?error=${encodeURIComponent(result.error ?? "Login failed.")}`,
    );
  }

  redirect("/admin");
}
