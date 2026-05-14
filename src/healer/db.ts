import type { HealerFixSource, HealerTechStack as PrismaHealerTechStack } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

import type { HealerFixPayload } from "./types.js";
import type { HealerTechStack } from "./types.js";

function toPrismaStack(s: HealerTechStack): PrismaHealerTechStack {
  return s as PrismaHealerTechStack;
}

let prisma: PrismaClient | null = null;

export function healerDbEnabled(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

export function getHealerPrisma(): PrismaClient | null {
  if (!healerDbEnabled()) return null;
  prisma ??= new PrismaClient();
  return prisma;
}

export async function findCachedFix(
  patternHash: string,
  stack: HealerTechStack
): Promise<{ id: string; fixPayload: HealerFixPayload } | null> {
  const db = getHealerPrisma();
  if (!db) return null;
  const row = await db.errorFixPattern.findUnique({
    where: {
      techStack_patternHash: {
        techStack: toPrismaStack(stack),
        patternHash
      }
    }
  });
  if (!row) return null;
  return { id: row.id, fixPayload: row.fixPayload as HealerFixPayload };
}

export async function upsertFixPattern(args: {
  patternHash: string;
  techStack: HealerTechStack;
  primaryFilePath: string | null;
  normalizedSnippet: string;
  rawSnippetPreview: string | null;
  fixPayload: HealerFixPayload;
  createdFrom: HealerFixSource;
  incrementSuccess: boolean;
}): Promise<void> {
  const db = getHealerPrisma();
  if (!db) return;

  const existing = await db.errorFixPattern.findUnique({
    where: {
      techStack_patternHash: {
        techStack: toPrismaStack(args.techStack),
        patternHash: args.patternHash
      }
    }
  });

  if (existing) {
    await db.errorFixPattern.update({
      where: { id: existing.id },
      data: {
        fixPayload: args.fixPayload as object,
        normalizedSnippet: args.normalizedSnippet,
        rawSnippetPreview: args.rawSnippetPreview,
        primaryFilePath: args.primaryFilePath,
        successCount: args.incrementSuccess ? { increment: 1 } : undefined,
        lastAppliedAt: args.incrementSuccess ? new Date() : undefined,
        updatedAt: new Date()
      }
    });
    return;
  }

  await db.errorFixPattern.create({
    data: {
      techStack: toPrismaStack(args.techStack),
      patternHash: args.patternHash,
      primaryFilePath: args.primaryFilePath,
      normalizedSnippet: args.normalizedSnippet,
      rawSnippetPreview: args.rawSnippetPreview,
      fixPayload: args.fixPayload as object,
      createdFrom: args.createdFrom,
      successCount: args.incrementSuccess ? 1 : 0,
      lastAppliedAt: args.incrementSuccess ? new Date() : null
    }
  });
}

export async function disconnectHealerDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
