import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client シングルトン
 * Next.js のホットリロード対策を含む
 */
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Development/Test環境ではグローバル変数でキャッシュ
  // ホットリロード時に複数のインスタンスが生成されるのを防ぐ
  const globalWithPrisma = global as typeof globalThis & {
    prisma: PrismaClient;
  };

  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient();
  }

  prisma = globalWithPrisma.prisma;
}

export default prisma;
