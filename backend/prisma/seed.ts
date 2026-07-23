import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/lib/password.js';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: env.SEED_ADMIN_EMAIL } });
  if (existing) {
    console.log(`[seed] admin already exists: ${existing.email}`);
    return;
  }

  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const admin = await prisma.user.create({
    data: {
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      name: env.SEED_ADMIN_NAME,
      role: 'admin',
    },
  });

  console.log(`[seed] created admin user: ${admin.email} (password: ${env.SEED_ADMIN_PASSWORD})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
