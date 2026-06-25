#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { create0GMemApi } from "@0g-mem/api";
import { create0GMemMcpHttpApp } from "@0g-mem/mcp/http-app";
import type { ZeroGMemConfig } from "@0g-mem/sdk";

loadEnvFile();

const port = Number(process.env.PORT ?? "8787");
const apiBaseUrl = publicApiBaseUrl();
const memoryPath = process.env.OG_MEM_API_MEMORY_PATH ?? ".0g-mem/api-memory.json";
const config = createConfigFromEnv();

const apiServer = create0GMemApi({
  config,
  memoryPath,
  auth: {
    appUrl: process.env.OG_MEM_APP_URL,
    returnDevVerificationToken: process.env.OG_MEM_RETURN_DEV_TOKENS !== "false"
  }
});
const mcpApp = create0GMemMcpHttpApp({ apiBaseUrl });

const server = createServer((request, response) => {
  const url = request.url ?? "/";

  if (request.method === "GET" && url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      service: "0g-mem-backend",
      rest: "/v1",
      mcp: "/mcp",
      apiBaseUrl
    }));
    return;
  }

  if (url === "/mcp" || url.startsWith("/mcp?")) {
    mcpApp(request, response);
    return;
  }

  apiServer.emit("request", request, response);
});

server.listen(port, () => {
  console.log(`0G-Mem backend listening on port ${port}`);
  console.log(`REST API available at ${apiBaseUrl}/v1`);
  console.log(`Streamable HTTP MCP available at ${apiBaseUrl}/mcp`);
  if (config.chain?.provider === "0g") {
    console.log(`0G proof registry enabled at ${config.chain.registryAddress}`);
  }
});

function publicApiBaseUrl() {
  if (process.env.OGMEM_API_URL) return process.env.OGMEM_API_URL.replace(/\/$/, "");
  if (process.env.OG_MEM_API_URL) return process.env.OG_MEM_API_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return `http://127.0.0.1:${process.env.PORT ?? "8787"}`;
}

function loadEnvFile(path = ".env") {
  const envPath = resolve(process.cwd(), path);
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = unquoteEnvValue(rawValue.trim());
  }
}

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function createConfigFromEnv(): ZeroGMemConfig {
  const config: ZeroGMemConfig = {};

  if (
    process.env.OG_EVM_RPC &&
    process.env.AEGIS_REGISTRY_ADDRESS &&
    process.env.OG_CHAIN_PRIVATE_KEY
  ) {
    config.chain = {
      provider: "0g",
      rpcUrl: process.env.OG_EVM_RPC,
      registryAddress: process.env.AEGIS_REGISTRY_ADDRESS,
      privateKey: process.env.OG_CHAIN_PRIVATE_KEY
    };
  }

  if (process.env.OG_COMPUTE_API_KEY) {
    config.compute = {
      provider: "0g-router",
      apiKey: process.env.OG_COMPUTE_API_KEY,
      baseUrl: process.env.OG_COMPUTE_BASE_URL,
      model: process.env.OG_COMPUTE_MODEL
    };
  }

  return config;
}
