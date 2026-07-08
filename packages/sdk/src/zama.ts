import { hashJson } from "./hash.js";
import type { MemoryRecord, OstraMemConfig } from "./types.js";

export const ZAMA_MEMORY_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordMemoryPointer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "memoryHash", type: "bytes32" },
      { name: "schemaHash", type: "bytes32" },
      { name: "uri", type: "string" }
    ],
    outputs: [{ name: "pointerId", type: "bytes32" }]
  }
] as const;

export type ZamaStatus = {
  enabled: boolean;
  provider: "local" | "zama";
  memoryRegistryAddress?: string;
  canSubmitTransactions: boolean;
  canAnchorMemory: boolean;
};

export type OstraMemoryAnchorResult = {
  provider: "local" | "zama";
  status: "prepared" | "submitted";
  memoryHash: string;
  schemaHash: string;
  contractAddress?: string;
  pointerId?: string;
  txHash?: string;
};

export class ZamaModule {
  constructor(private readonly config: OstraMemConfig["zama"] = { provider: "local" }) {}

  status(): ZamaStatus {
    const canAnchorMemory = Boolean(
      this.config?.provider === "zama" &&
        this.config.rpcUrl &&
        this.config.privateKey &&
        this.config.memoryRegistryAddress
    );

    return {
      enabled: this.config?.provider === "zama",
      provider: this.config?.provider === "zama" ? "zama" : "local",
      memoryRegistryAddress: this.config?.memoryRegistryAddress,
      canSubmitTransactions: canAnchorMemory,
      canAnchorMemory
    };
  }

  async anchorMemory(
    memory: MemoryRecord,
    schemaHash = hashJson({ schema: "ostra-mem-memory-v1" })
  ): Promise<OstraMemoryAnchorResult> {
    const result: OstraMemoryAnchorResult = {
      provider: "local",
      status: "prepared",
      memoryHash: memory.hash,
      schemaHash
    };

    if (!this.status().canAnchorMemory) {
      return result;
    }

    const submitted = await this.submitMemoryPointer(memory, schemaHash);
    return {
      ...result,
      provider: "zama",
      status: "submitted",
      contractAddress: this.config?.memoryRegistryAddress,
      pointerId: submitted.pointerId,
      txHash: submitted.txHash
    };
  }

  private async submitMemoryPointer(
    memory: MemoryRecord,
    schemaHash: string
  ): Promise<{ pointerId: string; txHash: string }> {
    if (!this.config?.rpcUrl || !this.config.privateKey || !this.config.memoryRegistryAddress) {
      throw new Error("Zama memory anchoring requires rpcUrl, privateKey, and memoryRegistryAddress.");
    }

    const { Contract, JsonRpcProvider, Wallet } = await loadEthers();
    const provider = new JsonRpcProvider(this.config.rpcUrl);
    const wallet = new Wallet(this.config.privateKey, provider);
    const contract = new Contract(
      this.config.memoryRegistryAddress,
      ZAMA_MEMORY_REGISTRY_ABI,
      wallet
    );
    const tx = await contract.recordMemoryPointer(
      agentIdToBytes32(memory.agentId),
      memory.hash,
      schemaHash,
      memory.storageUri ?? `memory://${memory.id}`
    );
    const receipt = await tx.wait();
    const pointerId =
      receipt?.logs?.find((log) =>
        log.address?.toLowerCase() === this.config?.memoryRegistryAddress?.toLowerCase()
      )?.topics?.[1] ?? "";
    return { pointerId, txHash: receipt?.hash ?? tx.hash };
  }
}

function agentIdToBytes32(agentId: string): string {
  return hashJson({ agentId });
}

type EthersSdk = {
  Contract: new (
    address: string,
    abi: readonly unknown[],
    signer: unknown
  ) => {
    recordMemoryPointer: (
      agentId: string,
      memoryHash: string,
      schemaHash: string,
      uri: string
    ) => Promise<{
      hash: string;
      wait(): Promise<TransactionReceiptLike | null>;
    }>;
  };
  JsonRpcProvider: new (url: string) => unknown;
  Wallet: new (privateKey: string, provider: unknown) => { address: string };
};

type TransactionReceiptLike = {
  hash?: string;
  logs?: Array<{
    address?: string;
    topics?: string[];
  }>;
};

const dynamicImport = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<unknown>;

async function loadEthers(): Promise<EthersSdk> {
  try {
    return (await dynamicImport("ethers")) as EthersSdk;
  } catch (error) {
    throw new Error("Zama memory anchoring requires optional dependency ethers@^6.17.0.", {
      cause: error
    });
  }
}
