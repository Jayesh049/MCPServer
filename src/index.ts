import { createMcpServer, startStdioServer } from "./mcp/server.js";
import { startHttpTransport } from "./mcp/httpServer.js";

const transport = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();
if (transport === "http" || process.env.MCP_HTTP_PORT || process.env.PORT) {
  const server = createMcpServer();
  await startHttpTransport(server, { includeRestApi: true });
} else {
  await startStdioServer();
}

