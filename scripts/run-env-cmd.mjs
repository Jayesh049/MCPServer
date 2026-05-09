import "./load-env-override.mjs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (!args.length) {
  process.stderr.write("Usage: node scripts/run-env-cmd.mjs <command> [args...]\n");
  process.exit(1);
}
const cmd = args[0];
const rest = args.slice(1);
const r = spawnSync(cmd, rest, { stdio: "inherit", shell: true, env: process.env });
process.exit(r.status ?? 1);
