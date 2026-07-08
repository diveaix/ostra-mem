import type { IncomingMessage, ServerResponse } from "node:http";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createOstraMemMcpServer } from "./create-server.js";

type McpHttpRequest = IncomingMessage & { body?: unknown };
type McpHttpResponse = ServerResponse;

export type CreateOstraMemMcpHttpAppOptions = {
  apiBaseUrl?: string;
};

export function createOstraMemMcpHttpApp(options: CreateOstraMemMcpHttpAppOptions = {}) {
  const apiBaseUrl =
    options.apiBaseUrl ??
    process.env.OSTRA_MEM_API_URL ??
    process.env.OG_MEM_API_URL ??
    "http://127.0.0.1:8787";
  const app = createMcpExpressApp({
    host: process.env.OG_MEM_MCP_HOST ?? "0.0.0.0",
    allowedHosts: allowedHosts(apiBaseUrl)
  });

  app.options("/mcp", (_req: McpHttpRequest, res: McpHttpResponse) => {
    setCorsHeaders(res);
    res.writeHead(204).end();
  });

  app.post("/mcp", async (req: McpHttpRequest, res: McpHttpResponse) => {
    setCorsHeaders(res);
    const apiKey = readBearerToken(req) ?? process.env.OSTRA_MEM_API_KEY ?? process.env.OG_MEM_API_KEY;

    if (!apiKey) {
      sendJsonRpcError(res, 401, -32001, "Missing bearer token. Use an Ostra Mem API key.");
      return;
    }

    const server = createOstraMemMcpServer({
      apiBaseUrl,
      apiKey,
      allowLocalFallback: false
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error("Error handling Ostra Mem MCP request:", error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, "Internal server error");
      }
    }
  });

  app.get("/mcp", (_req: McpHttpRequest, res: McpHttpResponse) => {
    setCorsHeaders(res);
    sendJsonRpcError(res, 405, -32000, "Method not allowed.");
  });

  app.delete("/mcp", (_req: McpHttpRequest, res: McpHttpResponse) => {
    setCorsHeaders(res);
    sendJsonRpcError(res, 405, -32000, "Method not allowed.");
  });

  return app;
}

function allowedHosts(apiBaseUrl: string) {
  const hosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

  addUrlHost(hosts, apiBaseUrl);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    hosts.add(process.env.RAILWAY_PUBLIC_DOMAIN);
  }
  for (const host of (process.env.OG_MEM_MCP_ALLOWED_HOSTS ?? "").split(",")) {
    const trimmed = host.trim();
    if (trimmed) hosts.add(trimmed);
  }

  return [...hosts];
}

function addUrlHost(hosts: Set<string>, value: string) {
  try {
    hosts.add(new URL(value).hostname);
  } catch {
    // Ignore non-URL values; explicit hosts can still be set through OG_MEM_MCP_ALLOWED_HOSTS.
  }
}

function readBearerToken(req: IncomingMessage) {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim();
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function sendJsonRpcError(
  res: ServerResponse,
  httpStatus: number,
  code: number,
  message: string
) {
  res.writeHead(httpStatus, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code, message },
    id: null
  }));
}
