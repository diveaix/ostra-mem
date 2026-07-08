export { OstraMem, ZeroGMem } from "./client.js";
export { OstraMemApiClient, ZeroGMemApiClient } from "./api-client.js";
export {
  LocalComputeClient,
  ZeroGComputeClient,
  createComputeFromConfig
} from "./compute.js";
export { OstraMemCore, ZeroGMemCore, createStorageFromConfig } from "./ogmem.js";
export { InMemoryStorage, JsonFileStorage, createMemoryRecord } from "./storage.js";
export { EncryptedJsonFileStorage } from "./storage-encrypted.js";
export { ZeroGStorageAdapter, createZeroGStorageAdapter } from "./storage-0g.js";
export { MemoryClient } from "./memory.js";
export { ContextClient } from "./context.js";
export { ProfileClient } from "./profile.js";
export { decodeTransaction, MAX_UINT_256, SELECTORS } from "./decoder.js";
export { TradesClient } from "./trades.js";
export { LearningClient } from "./learning.js";
export {
  VaultClient,
  buildGraph,
  vaultDocumentInputSchema
} from "./vault.js";
export {
  ZAMA_MEMORY_REGISTRY_ABI,
  ZamaModule
} from "./zama.js";
export { memoryInputSchema, tradePlanSchema, transactionSchema } from "./types.js";
export {
  LEGACY_PROOF_REGISTRY_ABI,
  LocalProofRecorder,
  ProofsClient,
  ZeroGChainProofRecorder,
  createProofRecorderFromConfig
} from "./proofs.js";
export type {
  ContextResult,
  AgentProfile,
  DecodedActionKind,
  DecodedTransaction,
  MemoryInput,
  MemoryKind,
  MemoryRecord,
  RiskDecision,
  RiskFinding,
  RiskSeverity,
  RiskVerdict,
  PrivateReasoning,
  ProofRecordInput,
  ProofRecordResult,
  TradePlan,
  TransactionRequest,
  OstraMemConfig,
  ZeroGMemConfig
} from "./types.js";
export type {
  VaultDocumentInput,
  VaultGraph,
  VaultGraphEdge,
  VaultGraphNode,
  VaultIngestResult
} from "./vault.js";
export type {
  OstraMemoryAnchorResult,
  ZamaStatus
} from "./zama.js";
export type {
  OstraMemApiClientConfig,
  ZeroGMemApiClientConfig
} from "./api-client.js";
