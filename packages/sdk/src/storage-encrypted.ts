import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createMemoryRecord, InMemoryStorage } from "./storage.js";
import type { MemoryInput, MemoryRecord } from "./types.js";

const ENCRYPTION_VERSION = 1;
const ENCRYPTION_SCHEME = "aes-256-gcm";
const AAD_PREFIX = "ostra-mem:vault-record:v1";

export type EncryptedJsonFileStorageOptions = {
  path?: string;
  vaultKey: string;
};

type EncryptedMemoryFile = {
  version: typeof ENCRYPTION_VERSION;
  scheme: typeof ENCRYPTION_SCHEME;
  records: EncryptedMemoryEnvelope[];
};

type EncryptedMemoryEnvelope = {
  id: string;
  hash: string;
  storageUri?: string;
  nonce: string;
  tag: string;
  ciphertext: string;
};

export class EncryptedJsonFileStorage extends InMemoryStorage {
  private readonly filePath: string;
  private readonly key: Buffer;

  constructor(options: EncryptedJsonFileStorageOptions) {
    super();
    this.filePath = options.path ?? ".ostra-mem/memory.vault.json";
    this.key = deriveVaultKey(options.vaultKey);
  }

  override async add(input: MemoryInput): Promise<MemoryRecord> {
    await this.load();
    const record = createMemoryRecord(input, "encrypted-file");
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

  override async search(input: {
    agentId: string;
    query?: string;
    kinds?: string[];
    limit?: number;
  }): Promise<MemoryRecord[]> {
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
      const parsed = JSON.parse(normalized) as unknown;
      this.memories.clear();

      if (Array.isArray(parsed)) {
        for (const record of parsed) {
          if (isMemoryRecord(record)) {
            this.save(record);
          }
        }
        return;
      }

      if (!isEncryptedMemoryFile(parsed)) {
        throw new Error(`Encrypted memory file ${this.filePath} has an unsupported format.`);
      }

      for (const envelope of parsed.records) {
        const record = decryptRecord(envelope, this.key);
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
    const encrypted: EncryptedMemoryFile = {
      version: ENCRYPTION_VERSION,
      scheme: ENCRYPTION_SCHEME,
      records: records.map((record) => encryptRecord(record, this.key))
    };

    await writeFile(this.filePath, `${JSON.stringify(encrypted, null, 2)}\n`);
  }
}

function encryptRecord(record: MemoryRecord, key: Buffer): EncryptedMemoryEnvelope {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(recordAad(record.id, record.hash));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(record), "utf8"),
    cipher.final()
  ]);

  return {
    id: record.id,
    hash: record.hash,
    storageUri: record.storageUri,
    nonce: nonce.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  };
}

function decryptRecord(envelope: EncryptedMemoryEnvelope, key: Buffer): unknown {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.nonce, "base64url")
  );
  decipher.setAAD(recordAad(envelope.id, envelope.hash));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString("utf8"));
}

function deriveVaultKey(secret: string): Buffer {
  if (!secret.trim()) {
    throw new Error("Encrypted memory storage requires a non-empty vault key.");
  }

  if (secret.startsWith("base64:")) {
    return assertKeyLength(Buffer.from(secret.slice("base64:".length), "base64"));
  }

  if (secret.startsWith("hex:")) {
    return assertKeyLength(Buffer.from(secret.slice("hex:".length), "hex"));
  }

  return scryptSync(secret, "ostra-mem-vault-v1", 32);
}

function assertKeyLength(key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error("Encrypted memory storage vault key must decode to 32 bytes.");
  }
  return key;
}

function recordAad(id: string, hash: string): Buffer {
  return createHash("sha256")
    .update(`${AAD_PREFIX}:${id}:${hash}`)
    .digest();
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function isEncryptedMemoryFile(value: unknown): value is EncryptedMemoryFile {
  if (!isRecord(value)) return false;
  return (
    value.version === ENCRYPTION_VERSION &&
    value.scheme === ENCRYPTION_SCHEME &&
    Array.isArray(value.records) &&
    value.records.every(isEncryptedMemoryEnvelope)
  );
}

function isEncryptedMemoryEnvelope(value: unknown): value is EncryptedMemoryEnvelope {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.hash === "string" &&
    (value.storageUri === undefined || typeof value.storageUri === "string") &&
    typeof value.nonce === "string" &&
    typeof value.tag === "string" &&
    typeof value.ciphertext === "string"
  );
}

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.agentId === "string" &&
    typeof value.kind === "string" &&
    typeof value.title === "string" &&
    typeof value.hash === "string" &&
    isRecord(value.content)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
