import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { withAccelerate } from "@prisma/extension-accelerate"

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL
  const accelerateUrl = process.env.ACCELERATE_URL ?? (databaseUrl?.startsWith("prisma://") ? databaseUrl : undefined)

  if (accelerateUrl) {
    return new PrismaClient({ accelerateUrl }).$extends(withAccelerate()) as unknown as PrismaClient
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl!,
    }),
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

