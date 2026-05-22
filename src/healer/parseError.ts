import type { HealerTechStack, ParsedHealerError } from "./types.js";

const TS_ERROR_LINE =
  /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/m;

const NEXT_FILE_LINE = /(?:^|\n)\s*(?:⨯|Error:)\s*(.+)$/m;
const NEXT_PATH = /(?:^|\s)([\w./\\-]+\.(?:tsx?|jsx?|mjs|cjs))(?:\s|$|\()/i;

/** Python traceback: File "path", line N, in ... */
const PY_FILE_LINE = /File\s+"([^"]+)",\s*line\s+(\d+)/;

const PY_EXCEPTION = /^(\w+Error|\w+Exception):\s*(.+)$/m;

function excerpt(s: string, max = 1200): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(-max);
}

function classifyNext(buffer: string): boolean {
  return (
    /next(\s+|\/)build/i.test(buffer) ||
    /\bTurbopack\b/i.test(buffer) ||
    /\bNext\.js\b/i.test(buffer) ||
    /Module not found/i.test(buffer)
  );
}

function tryParseTypeScript(buffer: string): ParsedHealerError | null {
  const m = buffer.match(TS_ERROR_LINE);
  if (!m?.[1] || !m[2] || !m[4] || !m[5]) return null;
  const file = m[1].trim();
  const line = Number(m[2]);
  const code = m[4].trim();
  const msg = m[5].trim();
  return {
    techStack: "NODE_TS",
    primaryFilePath: file,
    primaryLine: Number.isFinite(line) ? line : null,
    normalizedMessage: `${code}: ${msg}`,
    rawExcerpt: excerpt(buffer)
  };
}

const MODULE_NOT_FOUND =
  /Module not found: Can't resolve '([^']+)'(?:\s+in\s+'([^']+)')?/i;
const INVALID_ELEMENT =
  /Element type is invalid: expected a string \(for built-in components\) or a class\/function/i;
const UNHANDLED_RUNTIME =
  /Unhandled Runtime Error\s*\n\s*([^\n]+)/i;
const CANNOT_READ_PROP =
  /TypeError: Cannot read propert(?:y|ies) of (\S+) \(reading '([^']+)'\)/i;
const VITE_PRETRANSFORM = /\[vite\] Pre-transform error:\s*(.+)/i;

function tryParseNext(buffer: string): ParsedHealerError | null {
  if (!classifyNext(buffer)) return null;
  const ts = tryParseTypeScript(buffer);
  if (ts) {
    return { ...ts, techStack: "NEXT" };
  }
  const py = tryParsePython(buffer);
  if (py && classifyNext(buffer)) {
    return { ...py, techStack: "NEXT" };
  }
  let file: string | null = null;
  const fm = buffer.match(NEXT_FILE_LINE);
  if (fm?.[1]) {
    const candidate = fm[1].trim();
    if (/\.(tsx?|jsx?|mjs|cjs)/i.test(candidate)) {
      file = candidate.split(/\s+/)[0] ?? null;
    }
  }
  if (!file) {
    const pm = buffer.match(NEXT_PATH);
    file = pm?.[1]?.trim() ?? null;
  }
  const mod = buffer.match(MODULE_NOT_FOUND);
  if (mod) {
    return {
      techStack: "NEXT",
      primaryFilePath: mod[2]?.trim() ?? null,
      primaryLine: null,
      normalizedMessage: `Module not found: Cannot resolve '${mod[1]}'`,
      rawExcerpt: excerpt(buffer)
    };
  }

  const unhandled = buffer.match(UNHANDLED_RUNTIME);
  if (unhandled) {
    const pathM = buffer.match(/([^/\s]+\.(?:tsx?|jsx?)):(\d+)/);
    return {
      techStack: "NEXT",
      primaryFilePath: pathM?.[1] ?? file,
      primaryLine: pathM?.[2] ? Number(pathM[2]) : null,
      normalizedMessage: unhandled[1]!.trim().slice(0, 500),
      rawExcerpt: excerpt(buffer)
    };
  }

  const readProp = buffer.match(CANNOT_READ_PROP);
  if (readProp) {
    const pathM = buffer.match(/\(([^:]+):(\d+):\d+\)/);
    return {
      techStack: "NEXT",
      primaryFilePath: pathM?.[1]?.trim() ?? file,
      primaryLine: pathM?.[2] ? Number(pathM[2]) : null,
      normalizedMessage: `TypeError: Cannot read property '${readProp[2]}' of ${readProp[1]}`,
      rawExcerpt: excerpt(buffer)
    };
  }

  if (INVALID_ELEMENT.test(buffer)) {
    return {
      techStack: "NEXT",
      primaryFilePath: file,
      primaryLine: null,
      normalizedMessage: "Element type is invalid (check default vs named exports).",
      rawExcerpt: excerpt(buffer)
    };
  }

  const vite = buffer.match(VITE_PRETRANSFORM);
  if (vite) {
    return {
      techStack: "NEXT",
      primaryFilePath: file,
      primaryLine: null,
      normalizedMessage: `Vite pre-transform error: ${vite[1]!.trim().slice(0, 400)}`,
      rawExcerpt: excerpt(buffer)
    };
  }

  const oneLine = buffer
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.includes("Error") || l.includes("error"));
  return {
    techStack: "NEXT",
    primaryFilePath: file,
    primaryLine: null,
    normalizedMessage: (oneLine ?? buffer).slice(0, 500).trim(),
    rawExcerpt: excerpt(buffer)
  };
}

function tryParsePython(buffer: string): ParsedHealerError | null {
  if (!/Traceback \(most recent call last\)/s.test(buffer)) return null;
  const lines = buffer.split("\n");
  let lastFile: string | null = null;
  let lastLine: number | null = null;
  for (const line of lines) {
    const m = line.match(PY_FILE_LINE);
    if (m?.[1] && m[2]) {
      lastFile = m[1].trim();
      lastLine = Number(m[2]);
    }
  }
  const ex = buffer.match(PY_EXCEPTION);
  const msg = ex ? `${ex[1]}: ${(ex[2] ?? "").trim()}` : "Python traceback";
  return {
    techStack: "PYTHON",
    primaryFilePath: lastFile,
    primaryLine: lastLine,
    normalizedMessage: msg.slice(0, 500),
    rawExcerpt: excerpt(buffer)
  };
}

/** Pick the strongest parse from a log tail. */
export function parseHealerBuffer(buffer: string): ParsedHealerError | null {
  const tail = buffer.slice(-24_000);
  if (classifyNext(tail)) {
    const n = tryParseNext(tail);
    if (n) return n;
  }
  const ts = tryParseTypeScript(tail);
  if (ts) return ts;
  const py = tryParsePython(tail);
  if (py) return py;
  return null;
}

export function inferStackHint(cmd: string): HealerTechStack | null {
  const c = cmd.toLowerCase();
  if (/next|turbopack/.test(c)) return "NEXT";
  if (/flask|python|uvicorn|gunicorn/.test(c)) return "PYTHON";
  if (/tsx|tsc|node|npm/.test(c)) return "NODE_TS";
  return null;
}
