import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || password.length < 16) {
  throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 16 characters.');
}

const prisma = new PrismaClient();

try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('That email is already registered; refusing to change an existing account role.');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.create({
    data: { email, passwordHash, role: 'ADMIN' },
    select: { id: true },
  });
  console.log(`Administrator account created for ${email}`);
} finally {
  await prisma.$disconnect();
}
