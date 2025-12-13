import { PrismaClient } from "@prisma/client"; // Prisma ORM client
import { Pool } from "pg"; // Postgres connection pool
import { PrismaPg } from "@prisma/adapter-pg"; // Prisma adapter for pg

// Create a connection pool using DATABASE_URL from your env (.env / .env.local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a Prisma adapter that uses the pool
const adapter = new PrismaPg(pool);

// Cache Prisma client in dev to avoid too many connections on hot reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter, // ✅ REQUIRED in Prisma 7 when engine type is "client"
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
