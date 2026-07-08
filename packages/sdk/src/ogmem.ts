import { ContextClient } from "./context.js";
import { MemoryClient } from "./memory.js";
import { ProfileClient } from "./profile.js";
import { InMemoryStorage, JsonFileStorage, type MemoryStorage } from "./storage.js";
import { EncryptedJsonFileStorage } from "./storage-encrypted.js";
import { ZeroGStorageAdapter } from "./storage-0g.js";
import type { OstraMemConfig } from "./types.js";

export class OstraMemCore {
  readonly memory: MemoryClient;
  readonly context: ContextClient;
  readonly profile: ProfileClient;

  constructor(storage: MemoryStorage = new InMemoryStorage()) {
    this.memory = new MemoryClient(storage);
    this.context = new ContextClient(this.memory);
    this.profile = new ProfileClient(this.memory);
  }
}

export function createStorageFromConfig(
  storage: OstraMemConfig["storage"] = { provider: "local" }
): MemoryStorage {
  if (storage.provider === "file") {
    return new JsonFileStorage(storage.path);
  }

  if (storage.provider === "file-encrypted") {
    if (!storage.vaultKey) {
      throw new Error("Encrypted file storage requires vaultKey in storage config.");
    }
    return new EncryptedJsonFileStorage({
      path: storage.path,
      vaultKey: storage.vaultKey
    });
  }

  if (storage.provider !== "0g") {
    return new InMemoryStorage();
  }

  if (!storage.indexerRpc || !storage.evmRpc || !storage.privateKey) {
    throw new Error(
      "0G storage requires indexerRpc, evmRpc, and privateKey in storage config."
    );
  }

  return new ZeroGStorageAdapter({
    indexerRpc: storage.indexerRpc,
    evmRpc: storage.evmRpc,
    privateKey: storage.privateKey
  });
}

export { OstraMemCore as ZeroGMemCore };
