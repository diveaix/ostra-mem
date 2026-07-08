# Ostra Mem Demo Script

## Setup

```bash
npm install
npm run build
npm test
npm run contracts:compile:zama
```

Start the API and website:

```bash
npm run api:dev
npm run web:dev
```

Open:

```text
http://127.0.0.1:5173
```

## 2-3 Minute Flow

### 1. Frame The Product

Say:

Ostra Mem is an Obsidian-like private memory vault for company AI agents. It keeps raw company knowledge off-chain and encrypted, while Zama Sepolia stores only memory commitments.

### 2. Show The Vault

Open the dashboard and use the vault workspace.

Point out:

- companies can ingest policies, runbooks, notes, and large internal documents
- documents are split into retrievable chunks
- `[[wiki links]]` become graph edges
- encrypted-at-rest storage is enabled with `OSTRA_MEM_VAULT_KEY`
- Zama Sepolia stores only memory hashes and URIs, not plaintext

### 3. Show Agent Access

Create an API key from the dashboard.

Point out:

- dashboard users authenticate with email
- agents use scoped API keys
- API keys decide which workspace owns the memory
- `agentId` is routing metadata, not the security boundary

### 4. Show SDK/REST/MCP Integration

Use the Connect page or run:

```bash
npm run api:smoke
npm run mcp:http:dev
```

Available MCP tools include:

- `ostramem_add_memory`
- `ostramem_get_profile`
- `ostramem_context_for_trade_plan`
- `ostramem_record_outcome`
- `ostramem_reflect_failure`
- `ostramem_ingest_document`
- `ostramem_vault_graph`
- `ostramem_zama_status`

### 5. Show Zama Proof Point

Use the live transaction as proof that the registry path works:

```text
Memory registry: 0xC5b79f3c8879B085f25c3ab90668A5ff462DAdb2
Memory anchor tx: 0x369f1bc19ed373c18d0bd60f4021311efc3d28c60602521024cf3dcc130ef21a
```

## Expected Judge Takeaway

Company agents should not dump internal memory into public systems. Ostra Mem gives them private, scoped, graph-shaped memory and uses Zama testnet contracts only for hash commitments.
