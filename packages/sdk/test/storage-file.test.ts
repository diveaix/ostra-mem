import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { EncryptedJsonFileStorage, JsonFileStorage, OstraMem } from "../src/index.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("JsonFileStorage", () => {
  it("treats an empty file as an empty memory store", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ostra-mem-empty-"));
    const filePath = join(tempDir, "memory.json");
    await writeFile(filePath, "");
    const client = new OstraMem(
      {},
      new JsonFileStorage(filePath)
    );

    const memory = await client.ostraMem.memory.add({
      agentId: "agent",
      kind: "policy",
      title: "Policy",
      content: { note: "persist this" }
    });

    expect(memory.storageUri).toMatch(/^file:\/\//);
    expect(await client.ostraMem.memory.list("agent")).toHaveLength(1);
  });

  it("persists memory across SDK instances", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ostra-mem-"));
    const filePath = join(tempDir, "memory.json");
    const first = new OstraMem(
      {},
      new JsonFileStorage(filePath)
    );

    await first.ostraMem.memory.add({
      agentId: "agent",
      kind: "policy",
      title: "Policy",
      content: {
        allowedContracts: ["0x1111111111111111111111111111111111111111"]
      }
    });

    const second = new OstraMem(
      {},
      new JsonFileStorage(filePath)
    );
    const results = await second.ostraMem.memory.search({
      agentId: "agent",
      query: "Policy"
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.storageUri).toMatch(/^file:\/\//);
  });
});

describe("EncryptedJsonFileStorage", () => {
  it("treats an empty encrypted file as an empty memory store", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ostra-mem-vault-empty-"));
    const filePath = join(tempDir, "memory.vault.json");
    await writeFile(filePath, "");
    const client = new OstraMem(
      {},
      new EncryptedJsonFileStorage({ path: filePath, vaultKey: "test enterprise vault key" })
    );

    const memory = await client.ostraMem.memory.add({
      agentId: "company-agent",
      kind: "policy",
      title: "Vault policy",
      content: { note: "persist this privately" }
    });

    expect(memory.storageUri).toMatch(/^encrypted-file:\/\//);
    expect(await client.ostraMem.memory.list("company-agent")).toHaveLength(1);
  });

  it("stores ciphertext on disk while returning decrypted memory records", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ostra-mem-vault-"));
    const filePath = join(tempDir, "memory.vault.json");
    const vaultKey = "test enterprise vault key";
    const first = new OstraMem(
      {},
      new EncryptedJsonFileStorage({ path: filePath, vaultKey })
    );

    await first.ostraMem.memory.add({
      agentId: "company-agent",
      kind: "policy",
      title: "Board acquisition plan",
      content: {
        secret: "Acquire Contoso before public announcement",
        allowedContracts: ["0x1111111111111111111111111111111111111111"]
      },
      tags: ["board", "restricted"]
    });

    const raw = await readFile(filePath, "utf8");
    expect(raw).toContain("\"ciphertext\"");
    expect(raw).not.toContain("Acquire Contoso");
    expect(raw).not.toContain("Board acquisition plan");
    expect(raw).not.toContain("0x1111111111111111111111111111111111111111");

    const second = new OstraMem(
      {},
      new EncryptedJsonFileStorage({ path: filePath, vaultKey })
    );
    const results = await second.ostraMem.memory.search({
      agentId: "company-agent",
      query: "Contoso"
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Board acquisition plan");
    expect(results[0]?.storageUri).toMatch(/^encrypted-file:\/\//);
  });
});
