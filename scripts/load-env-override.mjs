/**
 * Load `.env` with override so project DATABASE_URL wins over a global/shell variable.
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });
