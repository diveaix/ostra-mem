#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createOstraMemApi } from "@ostra-mem/api";
import { createOstraMemMcpHttpApp } from "@ostra-mem/mcp/http-app";
import type { OstraMemConfig } from "@ostra-mem/sdk";

loadEnvFile();

const port = Number(process.env.PORT ?? "8787");
const apiBaseUrl = publicApiBaseUrl();
const memoryPath =
  process.env.OSTRA_MEM_API_MEMORY_PATH ??
  process.env.OG_MEM_API_MEMORY_PATH ??
  ".ostra-mem/api-memory.json";
const config = createConfigFromEnv(memoryPath);

const apiServer = createOstraMemApi({
  config,
  memoryPath,
  auth: {
    appUrl: process.env.OSTRA_MEM_APP_URL ?? process.env.OG_MEM_APP_URL,
    returnDevVerificationToken: process.env.OG_MEM_RETURN_DEV_TOKENS !== "false"
  }
});
const mcpApp = createOstraMemMcpHttpApp({ apiBaseUrl });

const server = createServer((request, response) => {
  const url = request.url ?? "/";

  if (request.method === "GET" && url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      service: "ostra-mem-backend",
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
  console.log(`Ostra Mem backend listening on port ${port}`);
  console.log(`REST API available at ${apiBaseUrl}/v1`);
  console.log(`Streamable HTTP MCP available at ${apiBaseUrl}/mcp`);
  if (config.chain?.provider === "0g") {
    console.log(`0G proof registry enabled at ${config.chain.registryAddress}`);
  }
  if (config.zama?.provider === "zama") {
    console.log(`Zama memory anchoring enabled at ${config.zama.memoryRegistryAddress}`);
  }
});

function publicApiBaseUrl() {
  if (process.env.OSTRA_MEM_API_URL) return process.env.OSTRA_MEM_API_URL.replace(/\/$/, "");
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

function createConfigFromEnv(memoryPath: string): OstraMemConfig {
  const config: OstraMemConfig = {};

  if (process.env.OSTRA_MEM_VAULT_KEY) {
    config.storage = {
      provider: "file-encrypted",
      path: memoryPath,
      vaultKey: process.env.OSTRA_MEM_VAULT_KEY
    };
  }

  if (
    process.env.OG_EVM_RPC &&
    process.env.OG_PROOF_REGISTRY_ADDRESS &&
    process.env.OG_CHAIN_PRIVATE_KEY
  ) {
    config.chain = {
      provider: "0g",
      rpcUrl: process.env.OG_EVM_RPC,
      registryAddress: process.env.OG_PROOF_REGISTRY_ADDRESS,
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

  if (
    process.env.ZAMA_RPC_URL &&
    process.env.ZAMA_PRIVATE_KEY &&
    process.env.ZAMA_MEMORY_REGISTRY_ADDRESS
  ) {
    config.zama = {
      provider: "zama",
      rpcUrl: process.env.ZAMA_RPC_URL,
      privateKey: process.env.ZAMA_PRIVATE_KEY,
      memoryRegistryAddress: process.env.ZAMA_MEMORY_REGISTRY_ADDRESS
    };
  }

  return config;
}
