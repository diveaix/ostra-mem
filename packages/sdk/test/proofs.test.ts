import { describe, expect, it } from "vitest";
import {
  LEGACY_PROOF_REGISTRY_ABI,
  ProofsClient,
  ZeroGMem,
  createProofRecorderFromConfig
} from "../src/index.js";

describe("proof recording", () => {
  it("records local decision proofs by default", async () => {
    const proofs = new ProofsClient();

    const result = await proofs.recordDecision({
      agentId: "agent-01",
      planHash: `0x${"1".repeat(64)}`,
      reportHash: `0x${"2".repeat(64)}`,
      decision: "BLOCK"
    });

    expect(result.provider).toBe("local");
    expect(result.proofHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result.txHash).toBeUndefined();
  });

  it("is wired through the SDK facade", async () => {
    const sdk = new ZeroGMem();

    const result = await sdk.proofs.recordDecision({
      agentId: "agent-01",
      planHash: `0x${"1".repeat(64)}`,
      reportHash: `0x${"2".repeat(64)}`,
      decision: "ALLOW"
    });

    expect(result.provider).toBe("local");
  });

  it("requires complete 0G chain config for live proofs", () => {
    expect(() =>
      createProofRecorderFromConfig({
        provider: "0g",
        rpcUrl: "https://evmrpc-testnet.0g.ai"
      })
    ).toThrow(/registryAddress/);
  });

  it("exports the registry ABI", () => {
    expect(
      LEGACY_PROOF_REGISTRY_ABI.some(
        (entry) => "name" in entry && entry.name === "recordDecision"
      )
    ).toBe(true);
  });
});
