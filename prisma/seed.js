/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require("bcryptjs");
const { PrismaClient, UserRole, UserStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Seed started");

  const login = process.env.SEED_ADMIN_LOGIN?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_FULL_NAME?.trim();

  if (!login || !password || !fullName) {
    throw new Error(
      "Missing required seed env values: SEED_ADMIN_LOGIN, SEED_ADMIN_PASSWORD, SEED_ADMIN_FULL_NAME.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.webUser.findUnique({
    where: { login },
    select: { id: true },
  });

  await prisma.webUser.upsert({
    where: { login },
    create: {
      login,
      fullName,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    update: {
      fullName,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(existing ? "Super admin updated" : "Super admin created");
  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
