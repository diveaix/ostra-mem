import { z } from "zod";

export const memoryKindSchema = z.enum([
  "agent_profile",
  "skill",
  "strategy",
  "policy",
  "trade_plan",
  "executed_trade",
  "risk_report",
  "blocked_action",
  "failure_lesson",
  "human_feedback",
  "protocol_profile",
  "enterprise_document",
  "document_chunk",
  "vault_link"
]);

export type MemoryKind = z.infer<typeof memoryKindSchema>;

export const memoryInputSchema = z.object({
  agentId: z.string().min(1),
  kind: memoryKindSchema,
  title: z.string().min(1),
  content: z.record(z.unknown()),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(["private", "public", "redacted"]).default("private"),
  createdAt: z.string().datetime().optional()
});

export type MemoryInput = z.input<typeof memoryInputSchema>;

export type MemoryRecord = z.output<typeof memoryInputSchema> & {
  id: string;
  hash: string;
  storageUri?: string;
};

export const transactionSchema = z.object({
  chainId: z.number().int().positive(),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  data: z.string().regex(/^0x([a-fA-F0-9]{2})*$/),
  value: z.string().default("0"),
  label: z.string().optional()
});

export type TransactionRequest = z.infer<typeof transactionSchema>;

export const tradePlanSchema = z.object({
  agentId: z.string().min(1),
  intent: z.string().min(1),
  txs: z.array(transactionSchema).min(1),
  metadata: z.record(z.unknown()).default({})
});

export type TradePlan = z.infer<typeof tradePlanSchema>;

export type ContextResult = {
  query: string;
  memories: MemoryRecord[];
};

export type AgentProfile = {
  agentId: string;
  static: MemoryRecord[];
  dynamic: MemoryRecord[];
  searchResults: MemoryRecord[];
  summary: {
    skills: string[];
    strategies: string[];
    policies: string[];
    recentRisks: string[];
    recentLessons: string[];
  };
};

export type RiskDecision = "ALLOW" | "WARN" | "BLOCK" | "REQUIRE_HUMAN";

export type RiskSeverity = "info" | "warning" | "critical";

export type RiskFinding = {
  code: string;
  severity: RiskSeverity;
  message: string;
  txIndex?: number;
};

export type DecodedActionKind =
  | "erc20_approve"
  | "erc20_transfer"
  | "erc20_transfer_from"
  | "native_transfer"
  | "contract_call";

export type DecodedTransaction = {
  txIndex: number;
  chainId: number;
  to: string;
  value: string;
  selector?: string;
  kind: DecodedActionKind;
  method: string;
  args: Record<string, string>;
  label?: string;
};

export type PrivateReasoning = {
  provider: "local" | "0g";
  model?: string;
  summary: string;
  raw?: unknown;
};

export type RiskVerdict = {
  planId: string;
  planHash: string;
  reportHash: string;
  decision: RiskDecision;
  riskScore: number;
  reason: string;
  decodedTransactions: DecodedTransaction[];
  findings: RiskFinding[];
  matchedMemories: string[];
  privateReasoning: PrivateReasoning;
};

export type ProofRecordInput = {
  agentId: string;
  planHash: string;
  reportHash: string;
  decision: RiskDecision;
};

export type ProofRecordResult = {
  proofHash: string;
  provider: "local" | "0g";
  txHash?: string;
  decisionId?: string;
};

export type OstraMemConfig = {
  agentId?: string;
  storage?: {
    provider: "local" | "file" | "file-encrypted" | "0g";
    path?: string;
    vaultKey?: string;
    indexerRpc?: string;
    evmRpc?: string;
    privateKey?: string;
  };
  compute?: {
    provider: "local" | "0g-private-computer" | "0g-router";
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  chain?: {
    provider: "local" | "0g";
    rpcUrl?: string;
    registryAddress?: string;
    privateKey?: string;
  };
  zama?: {
    provider: "local" | "zama";
    rpcUrl?: string;
    privateKey?: string;
    memoryRegistryAddress?: string;
  };
};

export type ZeroGMemConfig = OstraMemConfig;
