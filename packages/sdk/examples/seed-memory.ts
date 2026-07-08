import type { MemoryInput } from "../src/index.js";
import { createDemoSdk, fixturePath, readJsonFile } from "./shared.js";

const sdk = createDemoSdk();
const memories = await Promise.all([
  readJsonFile<MemoryInput>(fixturePath("policy.json")),
  readJsonFile<MemoryInput>(fixturePath("strategy.json"))
]);

const records = [];

for (const memory of memories) {
  records.push(await sdk.ostraMem.memory.add(memory));
}

console.log(
  JSON.stringify(
    {
      memoryPath: ".ostra-mem/demo-memory.json",
      stored: records.map((record) => ({
        id: record.id,
        kind: record.kind,
        title: record.title,
        hash: record.hash,
        storageUri: record.storageUri
      }))
    },
    null,
    2
  )
);
