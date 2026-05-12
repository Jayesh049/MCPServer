/**
 * MCP-only HTTP entry (no REST /api/*). Use with Dockerfile.mcp or SERVICE_ROLE=mcp-only.
 * Full API + MCP: use `src/index.ts` (default Dockerfile).
 */
import { createMcpServer } from "./mcp/server.js";
import { startHttpTransport } from "./mcp/httpServer.js";

const server = createMcpServer();
await startHttpTransport(server, { includeRestApi: false });
