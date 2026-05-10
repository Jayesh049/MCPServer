/**
 * Baseline seed: no fixed RAG catalog. Questions are created at runtime when users call web RAG.
 */
import { prisma } from "../src/lib/prisma.js";

async function main() {
  process.stderr.write("[seed] No static question catalog; dynamic RAG creates Question rows on demand.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
