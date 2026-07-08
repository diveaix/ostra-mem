# Ostra Mem Checklist

Use this when moving from local vault storage to live Zama memory anchoring.

Required env:

```env
ZAMA_RPC_URL=
ZAMA_PRIVATE_KEY=
ZAMA_EXPECTED_CHAIN_ID=11155111
ZAMA_MEMORY_REGISTRY_ADDRESS=
OSTRA_MEM_VAULT_KEY=
```

`ZAMA_RPC_URL` is an Ethereum Sepolia RPC URL. `ZAMA_PRIVATE_KEY` is the funded signer wallet key. `ZAMA_MEMORY_REGISTRY_ADDRESS` is the deployed registry contract address; it is not the private key.

Compile contracts:

```bash
npm run contracts:compile:zama
```

Deploy contracts:

```bash
npm run contracts:deploy:zama
```

Then restart the API or backend. SDK and MCP calls can ingest encrypted vault memory and anchor hash-only memory pointers when the registry address and funded key are configured.

For private enterprise memory, set `OSTRA_MEM_VAULT_KEY` before starting the API/backend/MCP. File-backed memory then uses encrypted-at-rest vault storage, while the Zama registry stores only memory hashes and URIs on Sepolia.
