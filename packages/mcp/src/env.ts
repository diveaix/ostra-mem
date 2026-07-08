import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OstraMemConfig } from "@ostra-mem/sdk";

export function loadEnvFile(path = ".env") {
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

export function createConfigFromEnv(memoryPath?: string): OstraMemConfig {
  const config: OstraMemConfig = {};

  if (process.env.OSTRA_MEM_VAULT_KEY) {
    config.storage = {
      provider: "file-encrypted",
      path: memoryPath,
      vaultKey: process.env.OSTRA_MEM_VAULT_KEY
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

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
