import "./load-env-override.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (!args.length) {
  process.stderr.write("Usage: node scripts/run-env-cmd.mjs <command> [args...]\n");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const prismaEntry = path.join(repoRoot, "node_modules", "prisma", "build", "index.js");

let cmd = args[0];
let rest = args.slice(1);

/** Avoid global `npx prisma` resolving to Prisma 7 (this repo stays on Prisma 6 schema). */
if (cmd === "prisma") {
  if (!fs.existsSync(prismaEntry)) {
    process.stderr.write(
      `Prisma CLI not found at ${prismaEntry}. Run npm ci (or npm install) in the repo root.\n`
    );
    process.exit(1);
  }
  cmd = process.execPath;
  rest = [prismaEntry, ...rest];
}

const r = spawnSync(cmd, rest, { stdio: "inherit", shell: false, env: process.env });
process.exit(r.status ?? 1);
