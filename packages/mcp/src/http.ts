#!/usr/bin/env node
import type { IncomingMessage, ServerResponse } from "node:http";
import { create0GMemMcpHttpApp } from "./http-app.js";

const port = Number(process.env.PORT ?? process.env.OG_MEM_MCP_HTTP_PORT ?? "8788");
const app = create0GMemMcpHttpApp();

app.get("/health", (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "0g-mem-mcp-http", transport: "streamable-http" }));
});

app.listen(port, (error?: Error) => {
  if (error) {
    console.error("Failed to start 0G-Mem MCP HTTP server:", error);
    process.exit(1);
  }
  console.log(`0G-Mem Streamable HTTP MCP listening on http://127.0.0.1:${port}/mcp`);
});
