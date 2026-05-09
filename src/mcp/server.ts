import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools.js";
import { handleToolCall } from "./toolHandlers.js";

export function createMcpServer() {
  const server = new Server(
    {
      name: "agents-assemble-sharp-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {},
        experimental: {
          // SHARP-on-MCP: advertise that FHIR context is required.
          fhir_context_required: { value: true }
        }
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
    const parsed = req.params;
    const headers = extra?.requestInfo?.headers;
    const metaFromHeaders =
      headers && typeof (headers as any).get === "function"
        ? {
            "X-FHIR-Server-URL": (headers as any).get("X-FHIR-Server-URL") ?? undefined,
            "X-FHIR-Access-Token": (headers as any).get("X-FHIR-Access-Token") ?? undefined,
            "X-Patient-ID": (headers as any).get("X-Patient-ID") ?? undefined
          }
        : {};

    return await handleToolCall({
      toolName: parsed.name,
      toolArguments: parsed.arguments ?? {},
      meta: { ...(parsed._meta as any), ...(metaFromHeaders as any) }
    });
  });

  return server;
}

export async function startStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

