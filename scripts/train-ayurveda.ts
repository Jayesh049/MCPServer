import "./load-env-override.mjs";
import { AYURVEDA_SOURCES } from "../src/ayurveda/sources.js";
import { rebuildAyurvedaCorpusForSource } from "../src/ayurveda/ingest.js";
import { prisma } from "../src/lib/prisma.js";

// Default to local embeddings for bulk indexing (faster + avoids external rate limits).
process.env.RAG_EMBEDDING_PROVIDER =
  process.env.AYURVEDA_EMBEDDING_PROVIDER?.trim() || process.env.RAG_EMBEDDING_PROVIDER || "local";

const label = process.env.AYURVEDA_TRAIN_LABEL?.trim() || "ayurveda-yoga-corpus";
const includeDisabled = (process.env.AYURVEDA_INCLUDE_DISABLED ?? "0") === "1";

async function main() {
  const run = await prisma.ragTrainingRun.create({
    data: { label, status: "running", metrics: { kind: "ayurveda", includeDisabled } }
  });

  const sources = AYURVEDA_SOURCES.filter((s) => includeDisabled || s.enabledByDefault);
  process.stdout.write(`[train-ayurveda] sources=${sources.length} includeDisabled=${includeDisabled}\n`);

  const results = [];
  let totalChunks = 0;
  let totalFailures = 0;

  for (const s of sources) {
    process.stdout.write(`[train-ayurveda] ingest ${s.id} (${s.urls.length} urls)\n`);
    const r = await rebuildAyurvedaCorpusForSource(s);
    results.push(r);
    totalChunks += r.chunksAdded;
    totalFailures += r.failures.length;
    process.stdout.write(
      `[train-ayurveda] done ${s.id}: urlsFetched=${r.urlsFetched} chunksAdded=${r.chunksAdded} failures=${r.failures.length}\n`
    );
    for (const f of r.failures.slice(0, 5)) {
      process.stdout.write(`  - fail ${f.url}: ${f.error}\n`);
    }
  }

  await prisma.ragTrainingRun.update({
    where: { id: run.id },
    data: {
      status: totalFailures ? "completed_with_warnings" : "completed",
      finishedAt: new Date(),
      metrics: { kind: "ayurveda", includeDisabled, totalChunks, totalFailures, results }
    }
  });

  process.stdout.write(`[train-ayurveda] complete totalChunks=${totalChunks} totalFailures=${totalFailures}\n`);
}

main()
  .catch(async (e) => {
    process.stderr.write(`[train-ayurveda] error: ${e?.message ? String(e.message) : String(e)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

