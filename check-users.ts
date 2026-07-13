import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const exerciseCount = await prisma.exercise.count();
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  console.log({ userCount, exerciseCount, users });
}

main().finally(() => prisma.$disconnect());
