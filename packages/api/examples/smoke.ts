import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOstraMemApi } from "../src/index.js";

const tempDir = await mkdtemp(join(tmpdir(), "ostra-mem-api-smoke-"));
const server = createOstraMemApi({
  authPath: join(tempDir, "auth.json"),
  memoryPath: join(tempDir, "memory.json")
});
await new Promise<void>((resolve) => server.listen(0, resolve));

try {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const apiKey = await createApiKey(baseUrl);

  const memory = await postJson(`${baseUrl}/v1/memory`, {
    agentId: "enterprise-vault",
    kind: "policy",
    title: "Security access policy",
    content: { scope: "security", note: "Escalate production access through security." },
    tags: ["security", "policy"]
  }, apiKey);
  const vault = await postJson(`${baseUrl}/v1/vault/ingest`, {
    agentId: "enterprise-vault",
    title: "Incident Runbook",
    text: "Escalate Sev-1 incidents through [[Security Policy]] before production access. ".repeat(10),
    tags: ["runbook", "security"]
  }, apiKey);
  const profile = await getJson(`${baseUrl}/v1/profile?agentId=enterprise-vault&query=security`, apiKey);
  const graph = await getJson(`${baseUrl}/v1/vault/graph?agentId=enterprise-vault`, apiKey);

  console.log(JSON.stringify({ memory, vault, profile, graph }, null, 2));
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  await rm(tempDir, { recursive: true, force: true });
}

async function createApiKey(baseUrl: string): Promise<string> {
  const login = await postJson(`${baseUrl}/auth/request-login`, {
    email: "smoke@example.com"
  }) as { devVerificationToken: string };
  const verifyResponse = await fetch(`${baseUrl}/auth/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token: login.devVerificationToken })
  });

  if (!verifyResponse.ok) {
    throw new Error(`verify failed with ${verifyResponse.status}: ${await verifyResponse.text()}`);
  }

  const cookie = verifyResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
  const key = await postJson(
    `${baseUrl}/api-keys`,
    { name: "smoke key" },
    undefined,
    cookie
  ) as { secret: string };

  return key.secret;
}

async function postJson(
  url: string,
  body: unknown,
  apiKey?: string,
  cookie?: string
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function getJson(url: string, apiKey?: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
  });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
