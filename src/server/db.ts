import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Lu directement (et non via getEnv) : la compilation de production importe ce fichier sans les secrets.
// La connexion n'est ouverte qu'à la première requête.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
