# Legacy 0G Checklist

This is an archived checklist for optional legacy 0G adapters retained from the original codebase. It is not required for the current Ostra Mem submission path, which uses encrypted local vault storage plus Zama Sepolia memory anchoring.

## 1. Environment

Copy `.env.example` and fill the values:

```bash
OG_STORAGE_INDEXER_RPC=
OG_EVM_RPC=
OG_STORAGE_PRIVATE_KEY=
OG_COMPUTE_API_KEY=
OG_COMPUTE_BASE_URL=https://router-api.0g.ai/v1
OG_COMPUTE_MODEL=zai-org/GLM-5-FP8
OG_PROOF_REGISTRY_ADDRESS=
OG_CHAIN_PRIVATE_KEY=
```

Never commit `.env`.

## 2. 0G Compute Router

Checklist:

- visit `https://pc.0g.ai`
- connect wallet
- deposit 0G tokens to the Router balance
- create an API key starting with `sk-`
- set `OG_COMPUTE_API_KEY`

The 0G docs describe the Router as an OpenAI-compatible API gateway. Mainnet endpoint:

```text
https://router-api.0g.ai/v1
```

Testnet endpoint:

```text
https://router-api-testnet.integratenetwork.work/v1
```

Source: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview

## 3. 0G Storage

Install optional live storage dependencies only when running live uploads:

```bash
npm install @0gfoundation/0g-storage-ts-sdk@1.2.10 ethers@^6.17.0
```

Set:

```bash
OG_STORAGE_INDEXER_RPC=<0g-storage-indexer-url>
OG_EVM_RPC=https://evmrpc-testnet.0g.ai
OG_STORAGE_PRIVATE_KEY=<funded-private-key>
```

Use SDK config:

```ts
const sdk = new ZeroGMem({
  storage: {
    provider: "0g",
    indexerRpc: process.env.OG_STORAGE_INDEXER_RPC,
    evmRpc: process.env.OG_EVM_RPC,
    privateKey: process.env.OG_STORAGE_PRIVATE_KEY
  }
});
```

The official storage SDK dependency chain may introduce third-party audit advisories when installed. The core SDK keeps these packages optional so local development and tests stay clean.

Source: https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk

## 4. Legacy 0G Chain Proof Registry

Contract:

```text
legacy proof registry contract
```

0G contract deployment docs currently specify Cancun EVM compatibility and these network values:

```text
0G Galileo testnet RPC: https://evmrpc-testnet.0g.ai
0G Galileo testnet chain ID: 16602
0G mainnet RPC: https://evmrpc.0g.ai
0G mainnet chain ID: 16661
```

After deploying the registry, set:

```bash
OG_PROOF_REGISTRY_ADDRESS=<deployed-contract-address>
OG_CHAIN_PRIVATE_KEY=<funded-private-key>
```

Use SDK config:

```ts
const sdk = new ZeroGMem({
  chain: {
    provider: "0g",
    rpcUrl: process.env.OG_EVM_RPC,
    registryAddress: process.env.OG_PROOF_REGISTRY_ADDRESS,
    privateKey: process.env.OG_CHAIN_PRIVATE_KEY
  }
});
```

Source: https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts

## 5. Before The Hackathon Demo

Run:

```bash
npm run build
npm test
npm run api:smoke
npm audit --omit=dev
```

For legacy 0G adapter demos, record these artifacts if credentials are available:

- a 0G Storage root hash for one memory object
- a 0G Compute response for private memory summarization
- a 0G Chain transaction hash from the legacy proof recorder
