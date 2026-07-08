import { describe, expect, it } from "vitest";
import { OstraMem } from "../src/index.js";

describe("VaultClient", () => {
  it("chunks enterprise documents and builds an Obsidian-style graph", async () => {
    const sdk = new OstraMem();

    const result = await sdk.vault.ingestDocument({
      agentId: "enterprise-vault",
      title: "Board Policy",
      text: "This confidential policy references [[Runbook Alpha]]. ".repeat(80),
      tags: ["board"],
      chunkSize: 360,
      chunkOverlap: 40
    });

    expect(result.document.kind).toBe("enterprise_document");
    expect(result.document.content).toMatchObject({
      chunkCount: result.chunks.length,
      links: ["Runbook Alpha"]
    });
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.graph.nodes.some((node) => node.id === result.document.id)).toBe(true);
    expect(result.graph.edges.some((edge) => edge.label === "contains")).toBe(true);

    const graph = await sdk.vault.graph("enterprise-vault");
    expect(graph.nodes.length).toBe(result.chunks.length + 1);
  });
});
