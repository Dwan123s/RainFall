import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let prismaInstance: PrismaClient | null = null;
let isPrismaConnected = false;
let verifiedTableCount = 0;
let dbVersionString = '';

/**
 * Returns a masked representation of the database URL for safe logging
 */
export function getMaskedDatabaseUrl(rawUrl: string = env.DATABASE_URL): string {
  try {
    const url = new URL(rawUrl.replace(/^postgresql:\/\//, 'http://').replace(/^postgres:\/\//, 'http://'));
    return `postgresql://${url.username ? `${url.username}:***@` : ''}${url.host}${url.pathname}${url.search}`;
  } catch {
    return 'postgresql://***@hidden-host/dbname';
  }
}

/**
 * Checks if the current configuration targets Aiven Cloud PostgreSQL
 */
export function isAivenDatabase(rawUrl: string = env.DATABASE_URL): boolean {
  return rawUrl.toLowerCase().includes('aivencloud.com');
}

/**
 * Singleton getter for PrismaClient
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    // Explicitly inject env.DATABASE_URL so Prisma Client always finds it
    process.env.DATABASE_URL = env.DATABASE_URL;
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_URL
        }
      },
      log: ['error', 'warn']
    });
  }
  return prismaInstance;
}

/**
 * Tests connection to the PostgreSQL database (Aiven or local), verifies tables, and logs status
 */
export async function testPrismaConnection(): Promise<boolean> {
  const isAiven = isAivenDatabase();
  const maskedUrl = getMaskedDatabaseUrl();

  // Validate SSL requirement for Aiven PostgreSQL
  if (isAiven && !env.DATABASE_URL.includes('sslmode=')) {
    logger.warn(
      'Aiven PostgreSQL requires SSL encryption! Please append "?sslmode=require" to your DATABASE_URL in .env'
    );
  }

  try {
    const client = getPrismaClient();
    await client.$connect();

    // Query PostgreSQL version
    const versionResult: Array<{ version: string }> = await client.$queryRaw`SELECT version();`;
    if (versionResult && versionResult.length > 0) {
      dbVersionString = versionResult[0].version;
    }

    // Inspect existing tables in public schema
    const tables: Array<{ tablename: string }> = await client.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `;
    verifiedTableCount = tables.length;

    // If database is empty, auto-push schema to create tables automatically
    if (verifiedTableCount === 0) {
      logger.info(
        'Empty database detected. Auto-creating RainSense tables on Aiven PostgreSQL via Prisma db push...'
      );
      try {
        const { execSync } = await import('child_process');
        execSync('npx prisma db push --schema=prisma/schema.prisma --accept-data-loss', {
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: env.DATABASE_URL }
        });

        // Re-inspect tables after push
        const refreshedTables: Array<{ tablename: string }> = await client.$queryRaw`
          SELECT tablename FROM pg_tables WHERE schemaname = 'public';
        `;
        verifiedTableCount = refreshedTables.length;
        logger.info(
          { tablesCreated: verifiedTableCount },
          'Successfully auto-created all RainSense tables on Aiven PostgreSQL!'
        );
      } catch (pushErr: unknown) {
        const err = pushErr as Error;
        logger.warn(
          { err: err.message },
          'Auto db push encountered an issue, will fallback to memory store if tables are missing.'
        );
      }
    }

    // Only set connected if tables actually exist
    isPrismaConnected = verifiedTableCount > 0;

    if (isAiven) {
      logger.info(
        { endpoint: maskedUrl, tablesFound: verifiedTableCount },
        'Aiven Cloud PostgreSQL connected successfully via Prisma ORM.'
      );
    } else {
      logger.info(
        { endpoint: maskedUrl, tablesFound: verifiedTableCount },
        'PostgreSQL database connected successfully via Prisma ORM.'
      );
    }

    // Alert if database is still empty
    if (verifiedTableCount === 0) {
      logger.warn(
        'Database connected, but no tables found in schema "public". Operating in Standalone Memory mode.'
      );
    }

    return isPrismaConnected;
  } catch (err: unknown) {
    const error = err as Error;
    isPrismaConnected = false;
    verifiedTableCount = 0;

    let hint = 'Operating in Standalone / Demo Repository mode.';
    if (isAiven) {
      hint =
        'Failed to connect to Aiven PostgreSQL. Verify your Aiven Service URI, check if your IP is allowed in Aiven, and ensure "?sslmode=require" is present.';
    }

    logger.warn({ err: error.message, hint }, 'Database connection could not be established.');
    return false;
  }
}

/**
 * Returns true if Prisma has a verified active connection
 */
export function isDbConnected(): boolean {
  return isPrismaConnected;
}

/**
 * Diagnostic function that tests the database connection with timing metrics
 */
export async function testPrismaConnectionDetail(): Promise<{
  success: boolean;
  latencyMs: number;
  isAiven: boolean;
  endpoint: string;
  version: string;
  tables: string[];
  message: string;
}> {
  const start = Date.now();
  const isAiven = isAivenDatabase();
  const endpoint = getMaskedDatabaseUrl();

  try {
    const client = getPrismaClient();
    await client.$connect();

    const versionResult: Array<{ version: string }> = await client.$queryRaw`SELECT version();`;
    const version = versionResult?.[0]?.version ?? 'PostgreSQL (version query returned empty)';

    const tablesResult: Array<{ tablename: string }> = await client.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename ASC;
    `;
    const tables = tablesResult.map((t) => t.tablename);

    const latencyMs = Date.now() - start;
    isPrismaConnected = true;
    verifiedTableCount = tables.length;
    dbVersionString = version;

    return {
      success: true,
      latencyMs,
      isAiven,
      endpoint,
      version,
      tables,
      message: `Successfully connected to ${isAiven ? 'Aiven Cloud ' : ''}PostgreSQL (${latencyMs}ms). Found ${tables.length} tables.`
    };
  } catch (err: unknown) {
    const error = err as Error;
    const latencyMs = Date.now() - start;
    isPrismaConnected = false;

    return {
      success: false,
      latencyMs,
      isAiven,
      endpoint,
      version: '',
      tables: [],
      message: `Database connection failed: ${error.message}`
    };
  }
}

/**
 * Returns current database runtime information
 */
export function getDbInfo() {
  return {
    connected: isPrismaConnected,
    provider: 'PostgreSQL',
    isAiven: isAivenDatabase(),
    endpoint: getMaskedDatabaseUrl(),
    tablesCount: verifiedTableCount,
    version: dbVersionString
  };
}
