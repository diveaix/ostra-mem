import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createId, hashJson } from "./hash.js";
import type { MemoryInput, MemoryRecord } from "./types.js";

export type MemorySearchInput = {
  agentId: string;
  query?: string;
  kinds?: string[];
  limit?: number;
};

export interface MemoryStorage {
  add(input: MemoryInput): Promise<MemoryRecord>;
  list(agentId: string): Promise<MemoryRecord[]>;
  listAll(): Promise<MemoryRecord[]>;
  delete(id: string): Promise<MemoryRecord | undefined>;
  search(input: MemorySearchInput): Promise<MemoryRecord[]>;
}

export class InMemoryStorage implements MemoryStorage {
  protected readonly memories = new Map<string, MemoryRecord>();

  async add(input: MemoryInput): Promise<MemoryRecord> {
    const record = createMemoryRecord(input, `local`);
    this.save(record);
    return record;
  }

  async list(agentId: string): Promise<MemoryRecord[]> {
    return [...this.memories.values()]
      .filter((memory) => memory.agentId === agentId)
      .sort((left, right) =>
        (right.createdAt ?? "").localeCompare(left.createdAt ?? "")
      );
  }

  async listAll(): Promise<MemoryRecord[]> {
    return [...this.memories.values()].sort((left, right) =>
      (right.createdAt ?? "").localeCompare(left.createdAt ?? "")
    );
  }

  async delete(id: string): Promise<MemoryRecord | undefined> {
    const record = this.memories.get(id);
    if (!record) return undefined;
    this.memories.delete(id);
    return record;
  }

  async search(input: MemorySearchInput): Promise<MemoryRecord[]> {
    const query = input.query?.toLowerCase().trim();
    const kinds = new Set(input.kinds ?? []);
    const records = await this.list(input.agentId);

    const filtered = records
      .filter((memory) => kinds.size === 0 || kinds.has(memory.kind))
      .map((memory) => ({
        memory,
        score: query ? scoreMemory(memory, query) : 1
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.limit ?? 10)
      .map(({ memory }) => memory);

    return filtered;
  }

  protected save(record: MemoryRecord): void {
    this.memories.set(record.id, record);
  }
}

export class JsonFileStorage extends InMemoryStorage {
  constructor(private readonly filePath = ".ostra-mem/memory.json") {
    super();
  }

  override async add(input: MemoryInput): Promise<MemoryRecord> {
    await this.load();
    const record = createMemoryRecord(input, "file");
    this.save(record);
    await this.persist();
    return record;
  }

  override async list(agentId: string): Promise<MemoryRecord[]> {
    await this.load();
    return super.list(agentId);
  }

  override async listAll(): Promise<MemoryRecord[]> {
    await this.load();
    return super.listAll();
  }

  override async delete(id: string): Promise<MemoryRecord | undefined> {
    await this.load();
    const record = await super.delete(id);
    if (record) {
      await this.persist();
    }
    return record;
  }

  override async search(input: MemorySearchInput): Promise<MemoryRecord[]> {
    await this.load();
    return super.search(input);
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const normalized = stripBom(raw).trim();
      if (!normalized) {
        this.memories.clear();
        return;
      }
      const records = JSON.parse(normalized) as MemoryRecord[];
      this.memories.clear();

      for (const record of records) {
        if (isMemoryRecord(record)) {
          this.save(record);
        }
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const records = [...this.memories.values()].sort((left, right) =>
      (left.createdAt ?? "").localeCompare(right.createdAt ?? "")
    );
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`);
  }
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

export function createMemoryRecord(
  input: MemoryInput,
  storageScheme?: string
): MemoryRecord {
  const now = new Date().toISOString();
  const recordWithoutHash = {
    id: createId("mem"),
    agentId: input.agentId,
    kind: input.kind,
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    visibility: input.visibility ?? "private",
    createdAt: input.createdAt ?? now
  };
  const hash = hashJson(recordWithoutHash);
  const storageUri = storageScheme
    ? `${storageScheme}://${recordWithoutHash.id}`
    : undefined;

  return {
    ...recordWithoutHash,
    hash,
    storageUri
  };
}

function scoreMemory(memory: MemoryRecord, query: string): number {
  const haystack = [
    memory.kind,
    memory.title,
    memory.tags.join(" "),
    JSON.stringify(memory.content)
  ]
    .join(" ")
    .toLowerCase();

  return query
    .split(/\s+/)
    .filter((token) => token.length > 1 && haystack.includes(token)).length;
}

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.agentId === "string" &&
    typeof record.kind === "string" &&
    typeof record.title === "string" &&
    typeof record.hash === "string" &&
    typeof record.content === "object"
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
