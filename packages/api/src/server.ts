import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createOstraMemApi } from "./index.js";
import type { OstraMemConfig } from "@ostra-mem/sdk";

loadEnvFile();

const port = Number(process.env.PORT ?? "8787");
const memoryPath =
  process.env.OSTRA_MEM_API_MEMORY_PATH ??
  process.env.OG_MEM_API_MEMORY_PATH ??
  ".ostra-mem/api-memory.json";
const config = createConfigFromEnv(memoryPath);

const server = createOstraMemApi({ config, memoryPath });

server.listen(port, () => {
  console.log(`Ostra Mem API listening on http://localhost:${port}`);
  if (config.chain?.provider === "0g") {
    console.log(`0G proof registry enabled at ${config.chain.registryAddress}`);
  }
  if (config.zama?.provider === "zama") {
    console.log(`Zama memory anchoring enabled at ${config.zama.memoryRegistryAddress}`);
  }
});

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
