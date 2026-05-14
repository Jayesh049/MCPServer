import { spawn, type ChildProcess } from "node:child_process";

import { parseHealerBuffer } from "./parseError.js";
import type { ParsedHealerError } from "./types.js";

export type SuperviseOptions = {
  cwd: string;
  /** Command executable (e.g. `npm`) */
  command: string;
  args: string[];
  debounceMs: number;
  /** Invoked after debounce when a parseable error appears. */
  onParsedError: (parsed: ParsedHealerError) => Promise<void>;
  /** Forward child stdout/stderr to terminal (default true). */
  forwardStreams?: boolean;
};

/**
 * Spawns a child process, tails combined stdout/stderr, and invokes `onParsedError`
 * when `parseHealerBuffer` finds a structured error (debounced).
 */
export function superviseDevProcess(opts: SuperviseOptions): { child: ChildProcess; stop: () => void } {
  const forward = opts.forwardStreams !== false;
  let buf = "";
  let timer: NodeJS.Timeout | null = null;
  let busy = false;

  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env: process.env,
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"]
  });

  const append = (chunk: Buffer, stream: "stdout" | "stderr") => {
    const s = chunk.toString("utf8");
    if (forward) {
      process[stream].write(s);
    }
    buf = (buf + s).slice(-48_000);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush();
    }, opts.debounceMs);
  };

  const flush = async () => {
    if (busy) return;
    const parsed = parseHealerBuffer(buf);
    if (!parsed) return;
    busy = true;
    try {
      await opts.onParsedError(parsed);
    } catch (e) {
      console.error("[healer] onParsedError:", e);
    } finally {
      busy = false;
    }
  };

  child.stdout?.on("data", (d: Buffer) => append(d, "stdout"));
  child.stderr?.on("data", (d: Buffer) => append(d, "stderr"));

  const stop = () => {
    if (timer) clearTimeout(timer);
    child.kill("SIGTERM");
  };

  return { child, stop };
}
