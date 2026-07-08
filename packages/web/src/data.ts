import type { LucideIcon } from "lucide-react";
import {
  Braces,
  Brain,
  Cpu,
  Database,
  GitBranch,
  KeyRound,
  Link2,
  Plug,
  ShieldCheck,
  TerminalSquare,
  Workflow,
  UserCircle2
} from "lucide-react";

export type Decision = "ALLOW" | "WARN" | "BLOCK" | "REQUIRE_HUMAN";

export type MemoryKind =
  | "agent_profile"
  | "skill"
  | "strategy"
  | "policy"
  | "trade_plan"
  | "executed_trade"
  | "risk_report"
  | "blocked_action"
  | "failure_lesson"
  | "human_feedback"
  | "protocol_profile"
  | "enterprise_document"
  | "document_chunk"
  | "vault_link";

export type MemorySource = "SDK" | "MCP" | "API" | "Manual" | "Vault";

export type MemoryNode = {
  id: string;
  kind: MemoryKind;
  title: string;
  detail: string;
  agentId: string;
  agentName: string;
  source: MemorySource;
  from: string;
  age: string;
  size: number;
  x: number;
  y: number;
  confidence: number;
  tags: string[];
  linked: string[];
  status: "synced" | "local";
};

export type ConnectionMethod = {
  id: "sdk" | "api" | "mcp";
  title: string;
  subtitle: string;
  icon: LucideIcon;
  command: string;
  bullets: string[];
};

export const kindLabels: Record<MemoryKind, string> = {
  agent_profile: "Agent profile",
  skill: "Skill",
  strategy: "Strategy",
  policy: "Policy",
  trade_plan: "Trade plan",
  executed_trade: "Executed trade",
  risk_report: "Risk report",
  blocked_action: "Blocked action",
  failure_lesson: "Failure lesson",
  human_feedback: "Human feedback",
  protocol_profile: "Protocol profile",
  enterprise_document: "Enterprise document",
  document_chunk: "Document chunk",
  vault_link: "Vault link"
};

export const sourceMeta: Record<
  MemorySource,
  { label: string; color: string; soft: string; detail: string }
> = {
  SDK: {
    label: "SDK",
    color: "#2563eb",
    soft: "rgba(37, 99, 235, 0.08)",
    detail: "native agent runtime"
  },
  MCP: {
    label: "MCP",
    color: "#7c3aed",
    soft: "rgba(124, 58, 237, 0.08)",
    detail: "tool call from an LLM agent"
  },
  API: {
    label: "API",
    color: "#0891b2",
    soft: "rgba(8, 145, 178, 0.08)",
    detail: "HTTP service or worker"
  },
  Manual: {
    label: "Manual",
    color: "#ea580c",
    soft: "rgba(234, 88, 12, 0.08)",
    detail: "operator dashboard entry"
  },
  Vault: {
    label: "Vault",
    color: "#16a34a",
    soft: "rgba(22, 163, 74, 0.08)",
    detail: "encrypted enterprise document"
  }
};

export const agentOptions = [
  { id: "enterprise-vault", name: "Enterprise Vault" },
  { id: "agent-arb-01", name: "Arb Sentinel" },
  { id: "agent-yield-02", name: "Yield Steward" },
  { id: "agent-risk-03", name: "Policy Keeper" }
];

export const stackItems = [
  {
    title: "Zama FHEVM",
    detail: "Private memory commitments can be anchored on Zama Sepolia without exposing the underlying data.",
    icon: Database
  },
  {
    title: "Encrypted Vault",
    detail: "Company documents are stored off-chain as encrypted memory and exposed only through scoped agent access.",
    icon: Cpu
  },
  {
    title: "Zama ACL",
    detail: "The architecture is ready for agent, owner, and auditor-specific access controls around private memory.",
    icon: KeyRound
  },
  {
    title: "Agent interfaces",
    detail: "SDK, MCP, and REST entry points so teams can connect the agents they already run.",
    icon: TerminalSquare
  }
];

export const connectionMethods: ConnectionMethod[] = [
  {
    id: "sdk",
    title: "TypeScript SDK",
    subtitle: "Best for agents already running in Node or a TypeScript execution service.",
    icon: Braces,
    command: "npm install @ostra-mem/sdk",
    bullets: [
      "Add memories from the agent runtime",
      "Ingest private documents into the vault",
      "Fetch profile and vault graph context"
    ]
  },
  {
    id: "mcp",
    title: "Streamable HTTP MCP",
    subtitle: "Best for Codex, Claude, and LLM agents that connect through a hosted MCP URL.",
    icon: Plug,
    command: "https://ostramem-backend-production.up.railway.app/mcp",
    bullets: [
      "Paste one HTTPS URL into the MCP client",
      "Use the agent API key as the bearer token",
      "Expose memory, vault ingest, graph, and profile tools"
    ]
  },
  {
    id: "api",
    title: "REST API",
    subtitle: "Best for Python agents, workers, notebooks, and hosted services.",
    icon: Link2,
    command: "https://ostramem-backend-production.up.railway.app/v1",
    bullets: [
      "POST /memory",
      "POST /vault/ingest and GET /vault/graph",
      "GET /profile for scoped retrieval"
    ]
  }
];

export const demoPlan = {
  agentId: "agent-risk-03",
  intent: "Approve USDC before depositing into a vault",
  txs: [
    {
      chainId: 16602,
      to: "0x1111111111111111111111111111111111111111",
      data: "0x095ea7b30000000000000000000000002222222222222222222222222222222222222222ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      value: "0",
      label: "Unlimited USDC approval to unknown spender"
    }
  ],
  metadata: { source: "web-dashboard-demo" }
};

export const productPillars = [
  {
    title: "Memory before action",
    body: "The agent retrieves scoped policies, runbooks, notes, and prior decisions before it acts.",
    icon: Database
  },
  {
    title: "Private enterprise vault",
    body: "Documents are chunked, encrypted at rest, linked as a graph, and exposed only through authenticated agent access.",
    icon: ShieldCheck
  },
  {
    title: "Learning after outcomes",
    body: "New notes, runbooks, and outcomes become reusable private context so agents do not start from scratch.",
    icon: GitBranch
  }
];

/* ── New data for supermemory-style landing ────────────── */

export type ProductFeature = {
  id: string;
  num: string;
  title: string;
  headline: string;
  body: string;
  icon: LucideIcon;
};

export const productFeatures: ProductFeature[] = [
  {
    id: "memory",
    num: "01",
    title: "Memory",
    headline: "Persistent context across sessions",
    body: "Company policies, runbooks, decisions, and agent notes are stored as private memory and retrieved before every action. No amnesia between runs.",
    icon: Brain
  },
  {
    id: "vault",
    num: "02",
    title: "Vault Graph",
    headline: "Obsidian-like knowledge structure",
    body: "Documents are split into chunks and wiki-style links become graph edges agents can traverse.",
    icon: ShieldCheck
  },
  {
    id: "learning",
    num: "03",
    title: "Learning",
    headline: "Structured failure reflection",
    body: "New project notes, incident writeups, and decisions become reusable context for future agent work.",
    icon: GitBranch
  },
  {
    id: "proofs",
    num: "04",
    title: "Hash Anchors",
    headline: "Private memory, public commitments",
    body: "Ostra anchors memory hashes and storage URIs on Zama Sepolia without publishing plaintext.",
    icon: KeyRound
  },
  {
    id: "profiles",
    num: "05",
    title: "Profiles",
    headline: "One-call agent identity",
    body: "Retrieve an agent's stable operating profile plus recent dynamic context in a single call. Skills, strategy, policy, and protocol trust — all in one response.",
    icon: UserCircle2
  },
  {
    id: "context",
    num: "06",
    title: "Context",
    headline: "Relevant memory retrieval",
    body: "Before an agent answers, the context module retrieves matching policies, runbooks, documents, and prior notes automatically.",
    icon: Workflow
  }
];

export type ComparisonRow = {
  aspect: string;
  legacy: string;
  ostraMem: string;
};

export const comparisonRows: ComparisonRow[] = [
  { aspect: "Memory", legacy: "Stateless between runs", ostraMem: "Persistent across sessions" },
  { aspect: "Retrieval", legacy: "Manual search", ostraMem: "Scoped profile and vault graph context" },
  { aspect: "Learning", legacy: "Repeat the same questions", ostraMem: "Reusable private notes and decisions" },
  { aspect: "Audit", legacy: "No trail", ostraMem: "Hash-only Zama Sepolia anchors" },
  { aspect: "Storage", legacy: "Centralized or none", ostraMem: "Private memory plus hash pointers" },
  { aspect: "Privacy", legacy: "Exposed reasoning", ostraMem: "FHE policy checks through Zama" }
];

export type HowItWorksStep = {
  num: string;
  title: string;
  body: string;
};

export const howItWorksSteps: HowItWorksStep[] = [
  { num: "1", title: "Plug in", body: "Install the SDK, start the MCP server, or point your agent at the REST API." },
  { num: "2", title: "Add memory", body: "Store strategies, policies, skills, and protocol trust profiles." },
  { num: "3", title: "Ingest documents", body: "Upload company notes, policies, runbooks, and datasets into encrypted vault memory." },
  { num: "4", title: "Explore graph", body: "Use chunks and wiki-style links as an Obsidian-like agent knowledge graph." },
  { num: "5", title: "Anchor hashes", body: "Optionally anchor memory hashes on Zama Sepolia without exposing plaintext." }
];
