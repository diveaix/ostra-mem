# Agent Connection Guide

Ostra Mem is the private memory layer that company agents call when they need scoped access to internal documents, notes, policies, and runbooks.

Security rule:

```text
agentId is routing metadata, not security.
The API key decides which workspace owns the memory.
```

Dashboard flow:

1. Open `/#dashboard`.
2. Enter email.
3. Open the confirmation link.
4. Create an API key.
5. Put that key in the agent runtime as `OSTRA_MEM_API_KEY`.

## 1. TypeScript SDK

```ts
import { OstraMemApiClient } from "@ostra-mem/sdk";

const client = new OstraMemApiClient({
  apiKey: process.env.OSTRA_MEM_API_KEY!,
  baseUrl: "http://127.0.0.1:8787"
});

await client.vault.ingestDocument({
  agentId: "enterprise-vault",
  title: "Internal Runbook",
  text: "Escalate production incidents through [[Security Policy]].",
  anchor: true
});

const graph = await client.vault.graph({ agentId: "enterprise-vault" });
const profile = await client.profile.get({
  agentId: "enterprise-vault",
  query: "security escalation"
});
```

## 2. REST API

Start the API:

```bash
npm run api:dev
```

Useful calls:

```text
GET  http://127.0.0.1:8787/health
POST http://127.0.0.1:8787/v1/memory
POST http://127.0.0.1:8787/v1/vault/ingest
GET  http://127.0.0.1:8787/v1/vault/graph?agentId=enterprise-vault
GET  http://127.0.0.1:8787/v1/profile?agentId=enterprise-vault&query=security
GET  http://127.0.0.1:8787/v1/zama/status
```

Minimal vault ingest:

```bash
curl -X POST http://127.0.0.1:8787/v1/vault/ingest \
  -H "Authorization: Bearer $OSTRA_MEM_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"agentId":"enterprise-vault","title":"Runbook","text":"Use [[Security Policy]] for escalation."}'
```

## 3. Streamable HTTP MCP

Start the API and MCP HTTP server locally:

```bash
npm run api:dev
npm run mcp:http:dev
```

Local development URL:

```text
http://127.0.0.1:8788/mcp
```

Available MCP tools:

```text
ostramem_add_memory
ostramem_get_profile
ostramem_context_for_trade_plan
ostramem_record_outcome
ostramem_reflect_failure
ostramem_ingest_document
ostramem_vault_graph
ostramem_zama_status
```

Example Streamable HTTP MCP client config:

```json
{
  "mcpServers": {
    "ostramem": {
      "type": "streamable-http",
      "url": "https://ostramem-backend-production.up.railway.app/mcp",
      "bearerTokenEnvVar": "OSTRA_MEM_API_KEY"
    }
  }
}
```

## Agent Memory Workflow

1. Agent stores structured memory or ingests a document.
2. Ostra Mem chunks documents and extracts wiki-style links.
3. Agent fetches profile or vault graph context.
4. Agent uses its own model/tooling to act.
5. Optional Zama Sepolia anchoring stores hash-only memory commitments.

## Live Zama Mode

Local mode is the demo path. Live Zama memory anchoring requires:

- `ZAMA_RPC_URL`
- funded `ZAMA_PRIVATE_KEY`
- deployed `ConfidentialMemoryRegistry`
- `OSTRA_MEM_VAULT_KEY` for encrypted-at-rest file storage

See `packages/web/public/docs/zama-checklist.md`.
