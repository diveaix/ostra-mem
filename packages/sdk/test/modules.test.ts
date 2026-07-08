import { describe, expect, it } from "vitest";
import { VaultClient, OstraMem, OstraMemCore, ZamaModule } from "../src/index.js";

describe("SDK module boundaries", () => {
  it("exposes Ostra Mem core, vault, and Zama modules in one SDK", async () => {
    const sdk = new OstraMem();

    expect(sdk.ostraMem).toBeInstanceOf(OstraMemCore);
    expect(sdk.memory).toBe(sdk.ostraMem.memory);
    expect(sdk.context).toBe(sdk.ostraMem.context);
    expect(sdk.vault).toBeInstanceOf(VaultClient);
    expect(sdk.zama).toBeInstanceOf(ZamaModule);
  });
});
