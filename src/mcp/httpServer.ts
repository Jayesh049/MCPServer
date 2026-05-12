import http from "node:http";
import type { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createMcpServer } from "./server.js";
import { handleApiRequest } from "../api/httpApi.js";

export type HttpTransportOptions = {
  port?: number;
  path?: string;
  /** When false, only `/mcp` and `/health` are served (no REST `/api/*`). */
  includeRestApi?: boolean;
};

function setMcpPathCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function isInitializeRequest(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  if (Array.isArray(body)) return body.some(isInitializeRequest);
  return (body as { method?: unknown }).method === "initialize";
}

/**
 * Streamable HTTP MCP server with per-session transports.
 *
 * The MCP Streamable HTTP spec requires one transport per client session, keyed by
 * the `Mcp-Session-Id` header. A single shared transport throws
 * "Server already initialized" whenever a second client tries to handshake.
 */
export async function startHttpTransport(
  _unusedServer: Server,
  opts?: HttpTransportOptions
) {
  const port = opts?.port ?? Number(process.env.PORT ?? process.env.MCP_HTTP_PORT ?? 3333);
  const mcpPath = opts?.path ?? "/mcp";
  const includeRestApi = opts?.includeRestApi !== false;

  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.statusCode = 400;
        res.end("Missing URL");
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

      if (!includeRestApi && req.method === "GET" && url.pathname === "/health") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, role: "mcp-only", time: new Date().toISOString() }));
        return;
      }

      if (includeRestApi && (await handleApiRequest(req, res))) return;

      if (url.pathname !== mcpPath) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      if (req.method === "OPTIONS") {
        setMcpPathCors(res);
        res.statusCode = 204;
        res.end();
        return;
      }

      setMcpPathCors(res);

      const sessionHeader = req.headers["mcp-session-id"];
      const sessionId =
        typeof sessionHeader === "string"
          ? sessionHeader
          : Array.isArray(sessionHeader)
            ? sessionHeader[0]
            : undefined;

      let body: unknown = undefined;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");
        body = raw.length ? JSON.parse(raw) : undefined;
      }

      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId);
      } else if (req.method === "POST" && isInitializeRequest(body)) {
        const created = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newId: string) => {
            transports.set(newId, created);
          }
        });
        created.onclose = () => {
          const id = created.sessionId;
          if (id) transports.delete(id);
        };
        const server = createMcpServer();
        await server.connect(created);
        transport = created;
      } else {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session id (send initialize first)."
            },
            id: null
          })
        );
        return;
      }

      await transport!.handleRequest(req as any, res as any, body);
    } catch (e: any) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
      }
      res.end(e?.message ? String(e.message) : "Server error");
    }
  });

  const host = process.env.HOST ?? "0.0.0.0";
  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  const mode = includeRestApi ? "MCP Streamable HTTP + REST API" : "MCP Streamable HTTP only";
  const paths = includeRestApi
    ? `(mcp at ${mcpPath}, api at /api/*)`
    : `(mcp at ${mcpPath}, GET /health for probes)`;
  process.stderr.write(`${mode} listening on http://${host}:${port} ${paths}\n`);
}
