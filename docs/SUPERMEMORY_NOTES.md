# Supermemory Notes For Ostra Mem

Sources checked:

- https://supermemory.ai/
- https://github.com/supermemoryai/supermemory

## Useful Patterns

Supermemory is useful as a reference because it packages memory as a developer primitive instead of just a database problem. The public README emphasizes:

- `add` for storing memories
- `profile` for stable facts plus recent context
- hybrid search across memories and documents
- local mode for self-hosted development
- MCP tools such as memory, recall, and context
- plugins for agent tools

## What Ostra Mem Takes From This

Ostra Mem adopts the ergonomics, not the product:

- `sdk.ostraMem.memory.add(...)`
- `sdk.vault.ingestDocument(...)`
- `sdk.ostraMem.profile.get(...)`
- `sdk.ostraMem.context.forTradePlan(...)`
- local file mode for demos
- HTTP adapter that can later be wrapped by MCP

The key idea is one-call context before an agent takes action.

## What Ostra Mem Does Differently

Ostra Mem is operational infrastructure for company agents that need private enterprise memory.

Differences:

- memory types support enterprise documents, policies, notes, and agent context
- enterprise documents are chunked into an Obsidian-like vault graph
- private memory hashes can be anchored on Zama Sepolia
- raw memory stays encrypted off-chain instead of being published to a public index

## What We Should Not Build For This Hackathon

Do not build:

- a Supermemory UI clone
- a consumer personal memory product
- generic Gmail/Drive/Notion connectors
- a leaderboard for tracking other people's private agents
- a demo trading bot

Those would dilute the hackathon story. The sharp demo is: company agents plug into Ostra Mem to use private memory, graph retrieval, and Zama hash anchoring.

