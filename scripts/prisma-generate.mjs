/**
 * Run `prisma generate` after freeing the query engine DLL on Windows.
 * EPERM happens when `npm run dev` (API on :3333) is still running.
 */
import { execSync } from "node:child_process";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const enginePath = join(
  root,
  "node_modules",
  ".prisma",
  "client",
  "query_engine-windows.dll.node"
);

function freePort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/LISTENING\s+(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Stopped process ${pid} (was using port ${port})`);
      } catch {
        /* already stopped */
      }
    }
  } catch {
    /* nothing listening */
  }
}

console.log("Stopping API on port 3333 if running (unlocks Prisma engine file)...");
freePort(3333);

if (existsSync(enginePath)) {
  try {
    unlinkSync(enginePath);
  } catch {
    /* may still be locked — user must close npm run dev manually */
  }
}

try {
  execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
  console.log("\nPrisma Client generated successfully.");
} catch {
  console.error(`
EPERM still blocked. Do this manually:
  1. In every terminal: press Ctrl+C on "npm run dev" (repo root)
  2. Close other Node/Prisma processes
  3. Run: npx prisma generate
  4. Start again: npm run dev
`);
  process.exit(1);
}
