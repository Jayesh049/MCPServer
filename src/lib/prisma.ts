import { PrismaClient } from "@prisma/client";

/** Bump when PlatformPatient / platform schema changes (forces new client after `prisma generate`). */
const PRISMA_CLIENT_VERSION = "20260524-platform-patient-languages";

type PrismaGlobal = {
  prisma?: PrismaClient;
  prismaVersion?: string;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

if (
  !globalForPrisma.prisma ||
  globalForPrisma.prismaVersion !== PRISMA_CLIENT_VERSION
) {
  void globalForPrisma.prisma?.$disconnect();
  globalForPrisma.prisma = createPrismaClient();
  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;
}

export const prisma = globalForPrisma.prisma;
