import type { MemoryClient } from "./memory.js";
import type { AgentProfile, MemoryRecord } from "./types.js";

const STATIC_KINDS = new Set([
  "agent_profile",
  "skill",
  "strategy",
  "policy",
  "protocol_profile"
]);

const DYNAMIC_KINDS = new Set([
  "trade_plan",
  "executed_trade",
  "risk_report",
  "blocked_action",
  "failure_lesson",
  "human_feedback",
  "enterprise_document",
  "document_chunk",
  "vault_link"
]);

export class ProfileClient {
  constructor(private readonly memory: MemoryClient) {}

  async get(input: {
    agentId: string;
    query?: string;
    limit?: number;
  }): Promise<AgentProfile> {
    const limit = input.limit ?? 10;
    const all = await this.memory.list(input.agentId);
    const staticMemories = all
      .filter((memory) => STATIC_KINDS.has(memory.kind))
      .slice(0, limit);
    const dynamicMemories = all
      .filter((memory) => DYNAMIC_KINDS.has(memory.kind))
      .slice(0, limit);
    const searchResults = input.query
      ? await this.memory.search({
          agentId: input.agentId,
          query: input.query,
          limit
        })
      : [];

    return {
      agentId: input.agentId,
      static: staticMemories,
      dynamic: dynamicMemories,
      searchResults,
      summary: {
        skills: titles(staticMemories, "skill"),
        strategies: titles(staticMemories, "strategy"),
        policies: titles(staticMemories, "policy"),
        recentRisks: titles(dynamicMemories, "risk_report", "blocked_action"),
        recentLessons: titles(dynamicMemories, "failure_lesson")
      }
    };
  }
}

function titles(memories: MemoryRecord[], ...kinds: string[]): string[] {
  const kindSet = new Set(kinds);
  return memories
    .filter((memory) => kindSet.has(memory.kind))
    .map((memory) => memory.title);
}
