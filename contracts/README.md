# Ostra Mem Contracts

## Zama Sepolia Memory Registry

`ConfidentialMemoryRegistry.sol` anchors private memory pointers without storing plaintext. It records:

- agent hash
- memory hash
- schema hash
- storage URI

Live Sepolia deployment:

```text
ConfidentialMemoryRegistry: 0xC5b79f3c8879B085f25c3ab90668A5ff462DAdb2
```

Compile:

```bash
npm run contracts:compile:zama
```

Deploy:

```bash
npm run contracts:deploy:zama
```

Required environment:

```env
ZAMA_RPC_URL=
ZAMA_PRIVATE_KEY=
ZAMA_MEMORY_REGISTRY_ADDRESS=
```

## Active Contract Surface

The active Ostra Mem contract surface is the memory registry above. It stores hash-only pointers for private memory artifacts; raw memory stays off-chain.
