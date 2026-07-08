import { LearningClient } from "./learning.js";
import { createComputeFromConfig } from "./compute.js";
import type { ComputeClient } from "./compute.js";
import { createStorageFromConfig, OstraMemCore } from "./ogmem.js";
import { createProofRecorderFromConfig, ProofsClient } from "./proofs.js";
import type { ContextClient } from "./context.js";
import type { MemoryClient } from "./memory.js";
import type { ProfileClient } from "./profile.js";
import type { MemoryStorage } from "./storage.js";
import { TradesClient } from "./trades.js";
import { VaultClient } from "./vault.js";
import { ZamaModule } from "./zama.js";
import type { OstraMemConfig } from "./types.js";

export class OstraMem {
  readonly ostraMem: OstraMemCore;
  readonly ogmem: OstraMemCore;
  readonly memory: MemoryClient;
  readonly context: ContextClient;
  readonly profile: ProfileClient;
  readonly trades: TradesClient;
  readonly learning: LearningClient;
  readonly proofs: ProofsClient;
  readonly zama: ZamaModule;
  readonly vault: VaultClient;
  private readonly compute: ComputeClient;

  constructor(
    readonly config: OstraMemConfig = {},
    storage: MemoryStorage = createStorageFromConfig(config.storage),
    compute: ComputeClient = createComputeFromConfig(config.compute)
  ) {
    this.ostraMem = new OstraMemCore(storage);
    this.ogmem = this.ostraMem;
    this.compute = compute;
    this.memory = this.ostraMem.memory;
    this.context = this.ostraMem.context;
    this.profile = this.ostraMem.profile;
    this.trades = new TradesClient(this.memory);
    this.learning = new LearningClient(this.memory, this.compute);
    this.proofs = new ProofsClient(createProofRecorderFromConfig(config.chain));
    this.zama = new ZamaModule(config.zama);
    this.vault = new VaultClient(this.memory, this.zama);
  }
}

export { OstraMem as ZeroGMem };
