/**
 * Load `.env` with override so project vars win over global/shell.
 * Supports split DB URLs: DATABASE_URL_DEV (local) vs DATABASE_URL_PRODUCTION (Neon/Render).
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

const dev = process.env.DATABASE_URL_DEV?.trim();
const prod = process.env.DATABASE_URL_PRODUCTION?.trim();
const explicit = process.env.DATABASE_URL?.trim();

const useProduction =
  process.env.NODE_ENV === "production" || process.env.USE_PRODUCTION_DB === "1";

if (dev || prod) {
  const chosen = useProduction ? prod || dev : dev || prod;
  if (chosen) process.env.DATABASE_URL = chosen;
} else if (!explicit) {
  // neither split nor single URL — Prisma will fail with a clear message
}
