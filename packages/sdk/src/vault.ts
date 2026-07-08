import { z } from "zod";
import type { MemoryClient } from "./memory.js";
import type { MemoryRecord } from "./types.js";
import type { OstraMemoryAnchorResult, ZamaModule } from "./zama.js";

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 120;
const MAX_CHUNK_SIZE = 8000;

export const vaultDocumentInputSchema = z.object({
  agentId: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  sourceUri: z.string().optional(),
  tags: z.array(z.string()).default([]),
  chunkSize: z.number().int().positive().max(MAX_CHUNK_SIZE).default(DEFAULT_CHUNK_SIZE),
  chunkOverlap: z.number().int().min(0).max(2000).default(DEFAULT_CHUNK_OVERLAP),
  anchor: z.boolean().default(false)
});

export type VaultDocumentInput = z.input<typeof vaultDocumentInputSchema>;

export type VaultGraphNode = {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  storageUri?: string;
};

export type VaultGraphEdge = {
  from: string;
  to: string;
  label: "contains" | "mentions" | "sequence";
};

export type VaultGraph = {
  nodes: VaultGraphNode[];
  edges: VaultGraphEdge[];
};

export type VaultIngestResult = {
  document: MemoryRecord;
  chunks: MemoryRecord[];
  graph: VaultGraph;
  anchors: OstraMemoryAnchorResult[];
};

export class VaultClient {
  constructor(
    private readonly memory: MemoryClient,
    private readonly zama?: ZamaModule
  ) {}

  async ingestDocument(input: VaultDocumentInput): Promise<VaultIngestResult> {
    const parsed = vaultDocumentInputSchema.parse(input);
    const chunkSize = parsed.chunkSize;
    const chunkOverlap = Math.min(parsed.chunkOverlap, chunkSize - 1);
    const extractedLinks = extractWikiLinks(parsed.text);
    const textChunks = chunkText(parsed.text, chunkSize, chunkOverlap);

    const document = await this.memory.add({
      agentId: parsed.agentId,
      kind: "enterprise_document",
      title: parsed.title,
      content: {
        sourceUri: parsed.sourceUri,
        charCount: parsed.text.length,
        wordCount: countWords(parsed.text),
        chunkCount: textChunks.length,
        links: extractedLinks,
        preview: parsed.text.slice(0, 320)
      },
      tags: uniqueTags(["enterprise-vault", "document", ...parsed.tags]),
      visibility: "private"
    });

    const chunks: MemoryRecord[] = [];
    for (const [index, chunk] of textChunks.entries()) {
      const chunkLinks = extractWikiLinks(chunk.text);
      const record = await this.memory.add({
        agentId: parsed.agentId,
        kind: "document_chunk",
        title: `${parsed.title} / ${index + 1}`,
        content: {
          documentId: document.id,
          documentTitle: parsed.title,
          chunkIndex: index,
          start: chunk.start,
          end: chunk.end,
          text: chunk.text,
          links: chunkLinks
        },
        tags: uniqueTags(["enterprise-vault", "chunk", ...parsed.tags]),
        visibility: "private"
      });
      chunks.push(record);
    }

    const graph = buildGraph([document, ...chunks]);
    const anchors = parsed.anchor
      ? await this.anchorMemories([document])
      : [];

    return { document, chunks, graph, anchors };
  }

  async graph(agentId: string): Promise<VaultGraph> {
    const records = (await this.memory.list(agentId)).filter((memory) =>
      memory.kind === "enterprise_document" ||
      memory.kind === "document_chunk" ||
      memory.kind === "vault_link"
    );
    return buildGraph(records);
  }

  private async anchorMemories(memories: MemoryRecord[]): Promise<OstraMemoryAnchorResult[]> {
    if (!this.zama) return [];

    const anchors: OstraMemoryAnchorResult[] = [];
    for (const memory of memories) {
      anchors.push(await this.zama.anchorMemory(memory));
    }
    return anchors;
  }
}

export function buildGraph(records: MemoryRecord[]): VaultGraph {
  const nodes = records.map((memory) => ({
    id: memory.id,
    title: memory.title,
    kind: memory.kind,
    tags: memory.tags,
    storageUri: memory.storageUri
  }));
  const byTitle = new Map(nodes.map((node) => [normalizeTitle(node.title), node.id]));
  const edges: VaultGraphEdge[] = [];

  for (const memory of records) {
    const content = memory.content as Record<string, unknown>;
    const documentId = typeof content.documentId === "string" ? content.documentId : undefined;
    if (memory.kind === "document_chunk" && documentId) {
      edges.push({ from: documentId, to: memory.id, label: "contains" });
    }

    for (const link of readLinks(content.links)) {
      const target = byTitle.get(normalizeTitle(link));
      if (target && target !== memory.id) {
        edges.push({ from: memory.id, to: target, label: "mentions" });
      }
    }
  }

  const chunksByDocument = new Map<string, MemoryRecord[]>();
  for (const memory of records) {
    const documentId = (memory.content as Record<string, unknown>).documentId;
    if (memory.kind !== "document_chunk" || typeof documentId !== "string") continue;
    const chunks = chunksByDocument.get(documentId) ?? [];
    chunks.push(memory);
    chunksByDocument.set(documentId, chunks);
  }
  for (const chunks of chunksByDocument.values()) {
    chunks.sort((left, right) => {
      const leftIndex = Number((left.content as Record<string, unknown>).chunkIndex ?? 0);
      const rightIndex = Number((right.content as Record<string, unknown>).chunkIndex ?? 0);
      return leftIndex - rightIndex;
    });
    for (let index = 1; index < chunks.length; index += 1) {
      edges.push({ from: chunks[index - 1].id, to: chunks[index].id, label: "sequence" });
    }
  }

  return { nodes, edges: dedupeEdges(edges) };
}

function chunkText(text: string, chunkSize: number, overlap: number) {
  const chunks: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;

  while (start < text.length) {
    const maxEnd = Math.min(text.length, start + chunkSize);
    let end = maxEnd;
    if (maxEnd < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n\n", maxEnd),
        text.lastIndexOf(". ", maxEnd),
        text.lastIndexOf(" ", maxEnd)
      );
      if (boundary > start + Math.floor(chunkSize * 0.55)) {
        end = boundary + (text[boundary] === "." ? 1 : 0);
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push({ text: chunk, start, end });
    }
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks.length ? chunks : [{ text, start: 0, end: text.length }];
}

function extractWikiLinks(text: string): string[] {
  const links = new Set<string>();
  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const title = match[1].split("|")[0]?.trim();
    if (title) links.add(title);
  }
  return [...links];
}

function readLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function dedupeEdges(edges: VaultGraphEdge[]): VaultGraphEdge[] {
  const seen = new Set<string>();
  const deduped: VaultGraphEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}:${edge.to}:${edge.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(edge);
  }
  return deduped;
}
