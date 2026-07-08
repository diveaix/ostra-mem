import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  OstraMem,
  OstraMemApiClient,
  memoryInputSchema,
  tradePlanSchema,
  vaultDocumentInputSchema,
  type MemoryInput,
  type TradePlan,
  type VaultDocumentInput,
  type OstraMemConfig
} from "@ostra-mem/sdk";

export type CreateOstraMemMcpServerOptions = {
  apiBaseUrl?: string;
  apiKey?: string;
  allowLocalFallback?: boolean;
  memoryPath?: string;
  config?: OstraMemConfig;
};

export function createOstraMemMcpServer(options: CreateOstraMemMcpServerOptions = {}) {
  const localConfig = createLocalConfig(options.config, options.memoryPath);
  const sdk = options.allowLocalFallback
    ? new OstraMem(localConfig)
    : undefined;
  const apiClient = options.apiKey
    ? new OstraMemApiClient({
        apiKey: options.apiKey,
        baseUrl: options.apiBaseUrl ?? "http://127.0.0.1:8787"
      })
    : undefined;

  const server = new McpServer({
    name: "Ostra Mem",
    version: "0.1.0"
  });

  server.tool(
    "ostramem_add_memory",
    "Store policy, strategy, trade, feedback, protocol, risk, or lesson memory for an agent.",
    memoryInputSchema.shape,
    async (input: MemoryInput) => {
      const memory = apiClient
        ? await apiClient.memory.add(input)
        : await requireLocalSdk(sdk).ostraMem.memory.add(input);
      return jsonResult({ memory });
    }
  );

  server.tool(
    "ostramem_get_profile",
    "Return stable agent profile memory plus recent dynamic memory and optional search results.",
    {
      agentId: z.string().min(1),
      query: z.string().optional(),
      limit: z.number().int().positive().max(50).optional()
    },
    async (input: { agentId: string; query?: string; limit?: number }) => {
      const profile = apiClient
        ? await apiClient.profile.get(input)
        : await requireLocalSdk(sdk).ostraMem.profile.get(input);
      return jsonResult({ profile });
    }
  );

  server.tool(
    "ostramem_context_for_trade_plan",
    "Retrieve relevant context for a transaction-shaped request.",
    tradePlanSchema.shape,
    async (input: TradePlan) => {
      const context = apiClient
        ? await apiClient.context.forTradePlan(input)
        : await requireLocalSdk(sdk).ostraMem.context.forTradePlan(input);
      return jsonResult({ context });
    }
  );

  server.tool(
    "ostramem_record_outcome",
    "Record what happened after a transaction plan was executed, failed, reverted, or skipped.",
    {
      agentId: z.string().min(1),
      planId: z.string().min(1),
      txHashes: z.array(z.string()).default([]),
      status: z.enum(["executed", "failed", "reverted", "skipped"]),
      pnlUsd: z.number().optional(),
      reason: z.string().optional(),
      notes: z.string().optional()
    },
    async (input) => {
      const outcome = apiClient
        ? await apiClient.trades.recordOutcome(input)
        : await requireLocalSdk(sdk).trades.recordOutcome(input);
      return jsonResult({ outcome });
    }
  );

  server.tool(
    "ostramem_reflect_failure",
    "Create a failure lesson for a plan using stored outcome and context memory.",
    {
      agentId: z.string().min(1),
      planId: z.string().min(1)
    },
    async (input) => {
      const lesson = apiClient
        ? await apiClient.learning.reflect(input)
        : await requireLocalSdk(sdk).learning.reflect(input);
      return jsonResult({ lesson });
    }
  );

  server.tool(
    "ostramem_ingest_document",
    "Chunk an enterprise document into encrypted Ostra Mem vault memory and optionally anchor its hash on Zama Sepolia.",
    vaultDocumentInputSchema.shape,
    async (input: VaultDocumentInput) => {
      const vault = apiClient
        ? await apiClient.vault.ingestDocument(input)
        : await requireLocalSdk(sdk).vault.ingestDocument(input);
      return jsonResult({ vault });
    }
  );

  server.tool(
    "ostramem_vault_graph",
    "Return the document/chunk/link graph for an enterprise vault agent.",
    {
      agentId: z.string().min(1)
    },
    async (input: { agentId: string }) => {
      const graph = apiClient
        ? await apiClient.vault.graph(input)
        : await requireLocalSdk(sdk).vault.graph(input.agentId);
      return jsonResult({ graph });
    }
  );

  server.tool(
    "ostramem_zama_status",
    "Return whether Zama memory anchoring is configured for this server.",
    {},
    async () => {
      const status = apiClient
        ? await apiClient.zama.status()
        : requireLocalSdk(sdk).zama.status();
      return jsonResult({ status });
    }
  );

  return server;
}

function createLocalConfig(
  config: OstraMemConfig | undefined,
  memoryPath = ".ostra-mem/mcp-memory.json"
): OstraMemConfig {
  if (!config?.storage) {
    return {
      ...(config ?? {}),
      storage: {
        provider: "file",
        path: memoryPath
      }
    };
  }

  if (
    (config.storage.provider === "file" || config.storage.provider === "file-encrypted") &&
    !config.storage.path
  ) {
    return {
      ...config,
      storage: {
        ...config.storage,
        path: memoryPath
      }
    };
  }

  return config;
}

function requireLocalSdk(sdk: OstraMem | undefined) {
  if (!sdk) {
    throw new Error(
      "Ostra Mem MCP requires an API key. Set OSTRA_MEM_API_KEY or pass a Bearer token."
    );
  }
  return sdk;
}

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
