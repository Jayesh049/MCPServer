import "./load-env-override.mjs";
import { spawnSync } from "node:child_process";

function run(parts) {
  const r = spawnSync(parts.join(" "), { stdio: "inherit", shell: true, env: process.env });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}

run(["npx", "prisma", "migrate", "deploy"]);
run(["npx", "prisma", "generate"]);
run(["npx", "tsx", "prisma/seed.ts"]);
process.stderr.write("[setup-all] Done.\n");
