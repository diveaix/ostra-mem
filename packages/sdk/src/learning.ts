import type { ComputeClient } from "./compute.js";
import type { MemoryClient } from "./memory.js";

export class LearningClient {
  constructor(
    private readonly memory: MemoryClient,
    private readonly compute: ComputeClient
  ) {}

  async reflect(input: { agentId: string; planId: string }) {
    const related = await this.memory.search({
      agentId: input.agentId,
      query: input.planId,
      kinds: ["executed_trade", "risk_report", "blocked_action"],
      limit: 5
    });

    const reflection = await this.compute.generate({
      purpose: "failure_reflection",
      system:
        "You are Ostra Mem Learning, a private reflection engine for autonomous trading agents. Produce one concise lesson that improves future safety without loosening policy.",
      user: JSON.stringify({
        planId: input.planId,
        relatedMemories: related.map((memory) => ({
          kind: memory.kind,
          title: memory.title,
          content: memory.content
        }))
      })
    });

    return this.memory.add({
      agentId: input.agentId,
      kind: "failure_lesson",
      title: `Lesson for ${input.planId}`,
      content: {
        planId: input.planId,
        relatedMemoryIds: related.map((memory) => memory.id),
        lesson: reflection.summary,
        privateReasoning: reflection,
        requiresHumanApproval: true
      },
      tags: ["failure-lesson", input.planId]
    });
  }
}
