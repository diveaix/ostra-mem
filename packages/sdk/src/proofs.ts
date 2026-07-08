import { hashJson } from "./hash.js";
import type {
  ProofRecordInput,
  ProofRecordResult,
  RiskDecision,
  ZeroGMemConfig
} from "./types.js";

export const LEGACY_PROOF_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordDecision",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "planHash", type: "bytes32" },
      { name: "reportHash", type: "bytes32" },
      { name: "decision", type: "uint8" }
    ],
    outputs: [{ name: "decisionId", type: "bytes32" }]
  },
  {
    type: "event",
    name: "DecisionRecorded",
    inputs: [
      { name: "decisionId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "planHash", type: "bytes32", indexed: true },
      { name: "reportHash", type: "bytes32", indexed: false },
      { name: "decision", type: "uint8", indexed: false },
      { name: "recorder", type: "address", indexed: false }
    ],
    anonymous: false
  }
] as const;

export interface ProofRecorder {
  recordDecision(input: ProofRecordInput): Promise<ProofRecordResult>;
}

export class LocalProofRecorder implements ProofRecorder {
  async recordDecision(input: ProofRecordInput): Promise<ProofRecordResult> {
    return {
      proofHash: hashJson(input),
      provider: "local"
    };
  }
}

export type ZeroGChainProofRecorderOptions = {
  rpcUrl: string;
  registryAddress: string;
  privateKey: string;
};

export class ZeroGChainProofRecorder implements ProofRecorder {
  constructor(private readonly options: ZeroGChainProofRecorderOptions) {}

  async recordDecision(input: ProofRecordInput): Promise<ProofRecordResult> {
    const { Contract, JsonRpcProvider, Wallet } = await loadEthers();
    const provider = new JsonRpcProvider(this.options.rpcUrl);
    const wallet = new Wallet(this.options.privateKey, provider);
    const contract = new Contract(
      this.options.registryAddress,
      LEGACY_PROOF_REGISTRY_ABI,
      wallet
    );
    const tx = await contract.recordDecision(
      agentIdToBytes32(input.agentId),
      input.planHash,
      input.reportHash,
      encodeDecision(input.decision)
    );
    const receipt = await tx.wait();

    return {
      proofHash: hashJson(input),
      provider: "0g",
      txHash: receipt?.hash ?? tx.hash
    };
  }
}

export class ProofsClient {
  constructor(private readonly recorder: ProofRecorder = new LocalProofRecorder()) {}

  async recordDecision(input: ProofRecordInput): Promise<ProofRecordResult> {
    return this.recorder.recordDecision(input);
  }
}

export function createProofRecorderFromConfig(
  chain: ZeroGMemConfig["chain"] = { provider: "local" }
): ProofRecorder {
  if (chain.provider !== "0g") {
    return new LocalProofRecorder();
  }

  if (!chain.rpcUrl || !chain.registryAddress || !chain.privateKey) {
    throw new Error(
      "0G chain proofs require rpcUrl, registryAddress, and privateKey in chain config."
    );
  }

  return new ZeroGChainProofRecorder({
    rpcUrl: chain.rpcUrl,
    registryAddress: chain.registryAddress,
    privateKey: chain.privateKey
  });
}

function encodeDecision(decision: RiskDecision): number {
  return {
    ALLOW: 0,
    WARN: 1,
    BLOCK: 2,
    REQUIRE_HUMAN: 3
  }[decision];
}

function agentIdToBytes32(agentId: string): string {
  return hashJson({ agentId });
}

type EthersSdk = {
  Contract: new (
    address: string,
    abi: typeof LEGACY_PROOF_REGISTRY_ABI,
    signer: unknown
  ) => {
    recordDecision(
      agentId: string,
      planHash: string,
      reportHash: string,
      decision: number
    ): Promise<{
      hash: string;
      wait(): Promise<{ hash?: string } | null>;
    }>;
  };
  JsonRpcProvider: new (url: string) => unknown;
  Wallet: new (privateKey: string, provider: unknown) => unknown;
};

const dynamicImport = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<unknown>;

async function loadEthers(): Promise<EthersSdk> {
  try {
    return (await dynamicImport("ethers")) as EthersSdk;
  } catch (error) {
    throw new Error(
      "0G Chain proof recording requires optional dependency ethers@^6.17.0.",
      { cause: error }
    );
  }
}
