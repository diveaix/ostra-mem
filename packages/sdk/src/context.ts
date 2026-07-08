import type { MemoryClient } from "./memory.js";
import { tradePlanSchema, type ContextResult, type TradePlan } from "./types.js";

const BASELINE_KINDS = new Set([
  "agent_profile",
  "skill",
  "strategy",
  "policy",
  "protocol_profile"
]);

export class ContextClient {
  constructor(private readonly memory: MemoryClient) {}

  async forTradePlan(input: TradePlan): Promise<ContextResult> {
    const plan = tradePlanSchema.parse(input);
    const addressTerms = plan.txs.map((tx) => tx.to).join(" ");
    const query = `${plan.intent} ${addressTerms}`;

    const baseline = (await this.memory.list(plan.agentId)).filter((memory) =>
      BASELINE_KINDS.has(memory.kind)
    );
    const searched = await this.memory.search({
      agentId: plan.agentId,
      query,
      kinds: [
        "agent_profile",
        "skill",
        "strategy",
        "policy",
        "risk_report",
        "blocked_action",
        "failure_lesson",
        "protocol_profile",
        "enterprise_document",
        "document_chunk",
        "vault_link"
      ],
      limit: 12
    });
    const memories = dedupeByKindAndTitle([...baseline, ...searched]).slice(0, 12);

    return { query, memories };
  }
}

function dedupeByKindAndTitle<T extends { kind: string; title: string }>(
  memories: T[]
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const memory of memories) {
    const key = `${memory.kind}:${memory.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(memory);
  }

  return deduped;
}
