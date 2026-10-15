import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prismaInstance: PrismaClient | null = null;
let isPrismaConnected = false;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: ['error', 'warn']
    });
  }
  return prismaInstance;
}

export async function testPrismaConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    // Test simple query
    await client.$queryRaw`SELECT 1`;
    isPrismaConnected = true;
    logger.info('Database connection established successfully via Prisma ORM.');
    return true;
  } catch (err: unknown) {
    const error = err as Error;
    isPrismaConnected = false;
    logger.warn({ err: error.message }, 'Database connection failed or not yet configured. Operating in Standalone / Demo Repository mode.');
    return false;
  }
}

export function isDbConnected(): boolean {
  return isPrismaConnected;
}
