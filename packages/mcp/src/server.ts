#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createOstraMemMcpServer } from "./create-server.js";
import { createConfigFromEnv, loadEnvFile } from "./env.js";

loadEnvFile();

const memoryPath =
  process.env.OSTRA_MEM_MCP_MEMORY_PATH ??
  process.env.OG_MEM_MCP_MEMORY_PATH ??
  ".ostra-mem/mcp-memory.json";
const server = createOstraMemMcpServer({
  allowLocalFallback: true,
  config: createConfigFromEnv(memoryPath),
  apiBaseUrl:
    process.env.OSTRA_MEM_API_URL ??
    process.env.OG_MEM_API_URL ??
    "http://127.0.0.1:8787",
  apiKey: process.env.OSTRA_MEM_API_KEY ?? process.env.OG_MEM_API_KEY,
  memoryPath
});

const transport = new StdioServerTransport();
await server.connect(transport);
