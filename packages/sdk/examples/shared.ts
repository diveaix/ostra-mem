import { readFile } from "node:fs/promises";
import { OstraMem } from "../src/index.js";

export const demoMemoryPath = ".ostra-mem/demo-memory.json";

export function createDemoSdk(): OstraMem {
  return new OstraMem({
    storage: {
      provider: "file",
      path: demoMemoryPath
    }
  });
}

export async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function fixturePath(name: string): string {
  return `packages/sdk/examples/fixtures/${name}`;
}
