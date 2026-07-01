import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const login = process.env.SEED_ADMIN_LOGIN?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_FULL_NAME?.trim();

  if (!login || !password || !fullName) {
    throw new Error(
      "Missing SEED_ADMIN_LOGIN, SEED_ADMIN_PASSWORD, or SEED_ADMIN_FULL_NAME.",
    );
  }

  const existing = await prisma.webUser.findUnique({
    where: { login },
  });

  if (existing) {
    console.log(`Super admin already exists for login "${login}".`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.webUser.create({
    data: {
      login,
      fullName,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Created super admin "${login}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
