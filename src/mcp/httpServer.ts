import http from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { handleApiRequest } from "../api/httpApi.js";

export async function startHttpTransport(server: Server, opts?: { port?: number; path?: string }) {
  const port = opts?.port ?? Number(process.env.PORT ?? process.env.MCP_HTTP_PORT ?? 3333);
  const mcpPath = opts?.path ?? "/mcp";

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  });

  await server.connect(transport);

  const httpServer = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.statusCode = 400;
        res.end("Missing URL");
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

      if (await handleApiRequest(req, res)) return;

      if (url.pathname !== mcpPath) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsedBody = raw.length ? JSON.parse(raw) : undefined;
        await transport.handleRequest(req as any, res as any, parsedBody);
        return;
      }

      await transport.handleRequest(req as any, res as any);
    } catch (e: any) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(e?.message ? String(e.message) : "Server error");
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  process.stderr.write(
    `MCP Streamable HTTP + REST API listening on http://localhost:${port} (mcp at ${mcpPath}, api at /api/*)\n`
  );
}
