import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createOstraMemApi } from "./index.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("Ostra Mem API", () => {
  it("returns a confirmation link without exposing a development token", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ostra-mem-api-"));
    const server = createOstraMemApi({
      authPath: join(tempDir, "auth.json"),
      memoryPath: join(tempDir, "memory.json"),
      auth: { returnDevVerificationToken: false }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const loginResponse = await fetch(`${baseUrl}/auth/request-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com" })
      });
      const login = (await loginResponse.json()) as {
        verificationUrl: string;
        devVerificationToken?: string;
      };

      expect(loginResponse.status).toBe(200);
      expect(login.verificationUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/verify\?token=/);
      expect(login.devVerificationToken).toBeUndefined();

      const token = new URL(login.verificationUrl).searchParams.get("token");
      expect(token).toBeTruthy();
      const verifyResponse = await fetch(`${baseUrl}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-Proto": "https"
        },
        body: JSON.stringify({ token })
      });
      const cookie = verifyResponse.headers.get("set-cookie");

      expect(verifyResponse.status).toBe(200);
      expect(cookie).toContain("SameSite=None");
      expect(cookie).toContain("Secure");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("requires API key ownership for memory and vault routes", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ostra-mem-api-"));
    const server = createOstraMemApi({
      authPath: join(tempDir, "auth.json"),
      memoryPath: join(tempDir, "memory.json"),
      auth: { returnDevVerificationToken: true }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const firstKey = await createApiKey(baseUrl, "first@example.com");
      const secondKey = await createApiKey(baseUrl, "second@example.com");
      const token = "0x1111111111111111111111111111111111111111";

      const unauthenticatedResponse = await fetch(`${baseUrl}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent",
          kind: "policy",
          title: "Policy",
          content: {}
        })
      });
      expect(unauthenticatedResponse.status).toBe(401);

      const memoryResponse = await fetch(`${baseUrl}/v1/memory`, {
        method: "POST",
        headers: authorizedHeaders(firstKey),
        body: JSON.stringify({
          agentId: "agent",
          kind: "policy",
          title: "Policy",
          content: {
            maxNativeValueWei: "0",
            allowedContracts: [token],
            trustedSpenders: [],
            maxTokenApprovalAmount: "10"
          }
        })
      });
      const memory = (await memoryResponse.json()) as {
        memory: { id: string; agentId: string; title: string };
      };
      expect(memoryResponse.status).toBe(201);
      expect(memory.memory.agentId).toBe("agent");

      const allMemoryResponse = await fetch(`${baseUrl}/v1/memory?limit=20`, {
        headers: { Authorization: `Bearer ${firstKey}` }
      });
      const allMemory = (await allMemoryResponse.json()) as {
        memories: Array<{ agentId: string; title: string }>;
      };
      expect(allMemoryResponse.status).toBe(200);
      expect(allMemory.memories).toEqual([
        expect.objectContaining({ agentId: "agent", title: "Policy" })
      ]);

      const vaultIngestResponse = await fetch(`${baseUrl}/v1/vault/ingest`, {
        method: "POST",
        headers: authorizedHeaders(firstKey),
        body: JSON.stringify({
          agentId: "enterprise-vault",
          title: "Enterprise Runbook",
          text: "Private runbook with [[Policy]] references. ".repeat(40),
          tags: ["enterprise"],
          chunkSize: 320,
          chunkOverlap: 32
        })
      });
      const vaultIngest = (await vaultIngestResponse.json()) as {
        vault: {
          document: { agentId: string; kind: string; title: string };
          chunks: Array<{ kind: string }>;
          graph: { nodes: unknown[]; edges: Array<{ label: string }> };
        };
      };
      expect(vaultIngestResponse.status).toBe(201);
      expect(vaultIngest.vault.document).toMatchObject({
        agentId: "enterprise-vault",
        kind: "enterprise_document",
        title: "Enterprise Runbook"
      });
      expect(vaultIngest.vault.chunks.length).toBeGreaterThan(1);
      expect(vaultIngest.vault.graph.edges.some((edge) => edge.label === "contains")).toBe(true);

      const vaultGraphResponse = await fetch(
        `${baseUrl}/v1/vault/graph?agentId=enterprise-vault`,
        { headers: { Authorization: `Bearer ${firstKey}` } }
      );
      const vaultGraph = (await vaultGraphResponse.json()) as {
        graph: { nodes: unknown[]; edges: Array<{ label: string }> };
      };
      expect(vaultGraphResponse.status).toBe(200);
      expect(vaultGraph.graph.nodes.length).toBe(vaultIngest.vault.chunks.length + 1);

      const isolatedMemoryResponse = await fetch(`${baseUrl}/v1/memory?limit=20`, {
        headers: { Authorization: `Bearer ${secondKey}` }
      });
      const isolatedMemory = (await isolatedMemoryResponse.json()) as {
        memories: Array<{ agentId: string; title: string }>;
      };
      expect(isolatedMemoryResponse.status).toBe(200);
      expect(isolatedMemory.memories).toEqual([]);

      const forbiddenDeleteResponse = await fetch(
        `${baseUrl}/v1/memory/${encodeURIComponent(memory.memory.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${secondKey}` }
        }
      );
      expect(forbiddenDeleteResponse.status).toBe(404);

      const firstProfileResponse = await fetch(
        `${baseUrl}/v1/profile?agentId=agent&query=Policy`,
        { headers: { Authorization: `Bearer ${firstKey}` } }
      );
      const firstProfile = (await firstProfileResponse.json()) as {
        profile: { summary: { policies: string[] } };
      };
      expect(firstProfileResponse.status).toBe(200);
      expect(firstProfile.profile.summary.policies).toEqual(["Policy"]);

      const secondProfileResponse = await fetch(
        `${baseUrl}/v1/profile?agentId=agent&query=Policy`,
        { headers: { Authorization: `Bearer ${secondKey}` } }
      );
      const secondProfile = (await secondProfileResponse.json()) as {
        profile: { summary: { policies: string[] } };
      };
      expect(secondProfileResponse.status).toBe(200);
      expect(secondProfile.profile.summary.policies).toEqual([]);

      const zamaStatusResponse = await fetch(`${baseUrl}/v1/zama/status`, {
        headers: { Authorization: `Bearer ${firstKey}` }
      });
      const zamaStatus = (await zamaStatusResponse.json()) as {
        status: { enabled: boolean; provider: string; canSubmitTransactions: boolean };
      };
      expect(zamaStatusResponse.status).toBe(200);
      expect(zamaStatus.status).toMatchObject({
        enabled: false,
        provider: "local",
        canSubmitTransactions: false
      });

      const deleteResponse = await fetch(
        `${baseUrl}/v1/memory/${encodeURIComponent(memory.memory.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${firstKey}` }
        }
      );
      const deleted = (await deleteResponse.json()) as {
        memory: { id: string; agentId: string };
      };
      expect(deleteResponse.status).toBe(200);
      expect(deleted.memory.id).toBe(memory.memory.id);
      expect(deleted.memory.agentId).toBe("agent");

      const afterDeleteResponse = await fetch(`${baseUrl}/v1/memory?limit=20`, {
        headers: { Authorization: `Bearer ${firstKey}` }
      });
      const afterDelete = (await afterDeleteResponse.json()) as {
        memories: Array<{ id: string }>;
      };
      expect(afterDelete.memories.some((item) => item.id === memory.memory.id)).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});

async function createApiKey(baseUrl: string, email: string): Promise<string> {
  const loginResponse = await fetch(`${baseUrl}/auth/request-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const login = (await loginResponse.json()) as { devVerificationToken: string };
  expect(loginResponse.status).toBe(200);

  const verifyResponse = await fetch(`${baseUrl}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: login.devVerificationToken })
  });
  expect(verifyResponse.status).toBe(200);
  const cookie = verifyResponse.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();

  const keyResponse = await fetch(`${baseUrl}/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie ?? ""
    },
    body: JSON.stringify({ name: "test key" })
  });
  const key = (await keyResponse.json()) as { secret: string };
  expect(keyResponse.status).toBe(201);
  return key.secret;
}

function authorizedHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}
