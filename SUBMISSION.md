# Ostra Mem SDK Hackathon Submission

## One-Liner

Ostra Mem is an Obsidian-like private memory vault for company AI agents, with encrypted-at-rest enterprise knowledge and hash-only Zama Sepolia anchoring.

## What We Built

- encrypted enterprise vault storage for company documents, policies, runbooks, and agent memory
- document chunking and `[[wiki link]]` graph retrieval
- TypeScript SDK, REST API, and Streamable HTTP MCP tools
- API-key scoped workspace access for agent clients
- web dashboard for vault ingest, graph browsing, memory provenance, API keys, and connection guidance
- Zama Sepolia memory registry for private memory hash commitments
- encrypted local file storage through `OSTRA_MEM_VAULT_KEY`

The product is private memory infrastructure for company agents. Raw memory stays off-chain; Zama Sepolia receives only hashes and storage URIs.

## Why It Matters

Company agents need memory, but useful memory is often sensitive: escalation paths, customer context, operational runbooks, internal policies, and incident notes. Ostra Mem lets teams give agents usable private context without publishing the data on-chain.

Ostra Mem lets an agent ask:

1. What private company context am I allowed to use?
2. What documents, notes, and policies are relevant?
3. How are those documents linked?
4. Can the owner later verify that a private memory hash was anchored?

## How Zama Is Used

### Encrypted Vault Memory

When `OSTRA_MEM_VAULT_KEY` is set, file-backed API/backend/MCP storage uses AES-256-GCM. Plaintext document content is not written to the JSON vault file. The app decrypts only inside the running process for authenticated retrieval.

### Zama Sepolia Memory Anchoring

`ConfidentialMemoryRegistry.sol` stores only:

- `agentId` hash
- memory hash
- schema hash
- storage URI

This proves a private memory pointer existed without exposing the memory itself.

Live registry deployment:

```text
0xC5b79f3c8879B085f25c3ab90668A5ff462DAdb2
```

Verified live memory anchor:

```text
0x369f1bc19ed373c18d0bd60f4021311efc3d28c60602521024cf3dcc130ef21a
```

## Demo Commands

```bash
npm install
npm run build
npm test
npm run contracts:compile:zama
npm run api:smoke
```

Run the website:

```bash
npm run api:dev
npm run web:dev
```

Run Streamable HTTP MCP:

```bash
npm run mcp:http:dev
```

## Demo Story

1. Log in to the dashboard and create an agent API key.
2. Ingest an enterprise document into the vault.
3. Show encrypted document records, chunks, and wiki-style graph links.
4. Fetch the vault graph through SDK, REST, or MCP.
5. Anchor a private memory hash on Zama Sepolia.
6. Show that raw company memory stays off-chain.

## Current MVP Status

Done:

- Ostra Mem rename and yellow visual theme
- TypeScript monorepo
- SDK facade with memory, vault, profile, storage, and Zama modules
- encrypted file storage
- enterprise document ingest and graph retrieval
- REST API
- Streamable HTTP MCP server
- dashboard with vault workspace
- `ConfidentialMemoryRegistry` contract
- Zama Sepolia deployment
- live memory-anchor transaction
- tests and build verification

Legacy compatibility kept:

- original 0G adapters remain in the repo
- local prepared mode remains available when Zama credentials are not configured

See `README.md` and `packages/web/public/docs/zama-checklist.md` for the setup flow.
