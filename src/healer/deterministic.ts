import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { HealerTechStack } from "./types.js";

function run(cmd: string, args: string[], cwd: string): boolean {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return r.status === 0;
}

/**
 * Best-effort eslint/ruff --fix on the primary file from the parse.
 * Returns true if a fixer command ran (exit 0); does not guarantee the original error is gone.
 */
export function runDeterministicFixes(repoRoot: string, primaryFilePath: string | null, stack: HealerTechStack): boolean {
  if (!primaryFilePath) return false;
  const rel = primaryFilePath.replace(/\\/g, "/");
  const abs = path.resolve(repoRoot, rel);
  if (!fs.existsSync(abs)) return false;

  const ext = path.extname(abs).toLowerCase();
  if ((stack === "NODE_TS" || stack === "NEXT") && [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    const extBin = process.platform === "win32" ? ".cmd" : "";
    const eslintBin = path.join(repoRoot, "node_modules", ".bin", `eslint${extBin}`);
    if (fs.existsSync(eslintBin)) {
      return run(eslintBin, [abs, "--fix", "--no-error-on-unmatched-pattern"], repoRoot);
    }
    return run("npx", ["eslint", abs, "--fix", "--no-error-on-unmatched-pattern"], repoRoot);
  }

  if (stack === "PYTHON" && ext === ".py") {
    const ruff = spawnSync("ruff", ["check", abs, "--fix"], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (ruff.error && (ruff.error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    return ruff.status === 0;
  }

  return false;
}
