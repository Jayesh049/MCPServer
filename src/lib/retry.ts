export type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isRetryable?: (e: unknown) => boolean;
  label?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number): number {
  const j = Math.floor(ms * (0.2 * Math.random()));
  return ms + j;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const maxDelayMs = opts.maxDelayMs ?? 3000;
  const isRetryable =
    opts.isRetryable ??
    ((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      return (
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("fetch failed") ||
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("Prisma") ||
        msg.includes("Connection")
      );
    });

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (attempt > retries || !isRetryable(e)) throw e;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      console.warn(
        `[retry] ${opts.label ?? "op"} failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms.`,
        e
      );
      await sleep(jitter(delay));
    }
  }
}

