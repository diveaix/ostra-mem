import { describe, expect, it } from "vitest";
import { OstraMem } from "../src/index.js";

describe("Zama memory anchoring", () => {
  it("prepares a hash-only memory pointer without configured credentials", async () => {
    const mem = new OstraMem();
    const memory = await mem.memory.add({
      agentId: "enterprise-vault",
      kind: "enterprise_document",
      title: "Security Runbook",
      content: {
        preview: "Escalate Sev-1 incidents through security."
      },
      tags: ["security", "runbook"]
    });

    const anchor = await mem.zama.anchorMemory(memory);

    expect(anchor.provider).toBe("local");
    expect(anchor.status).toBe("prepared");
    expect(anchor.memoryHash).toBe(memory.hash);
    expect(anchor.schemaHash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
