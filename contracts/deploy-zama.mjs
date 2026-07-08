import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  formatEther
} from "ethers";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(rootDir, ".env");
const compileOnly = process.argv.includes("--compile-only");
const force = process.argv.includes("--force");
const defaultExpectedChainId = 11155111n;
const solcImportReadCache = new Map();

const contracts = [
  {
    sourceName: "contracts/ConfidentialMemoryRegistry.sol",
    contractName: "ConfidentialMemoryRegistry",
    envKey: "ZAMA_MEMORY_REGISTRY_ADDRESS",
    artifactName: "ostra-memory-registry.json"
  }
];

const compiled = await compile();

if (compileOnly) {
  for (const item of contracts) {
    const contract = compiled[item.contractName];
    console.log(`${item.contractName} compiled: ${contract.bytecode.length / 2 - 1} bytes`);
  }
  process.exit(0);
}

const env = await readEnv(envPath);
const rpcUrl = env.ZAMA_RPC_URL;
const privateKey = env.ZAMA_PRIVATE_KEY;
const expectedChainId = BigInt(env.ZAMA_EXPECTED_CHAIN_ID ?? defaultExpectedChainId);

if (!rpcUrl) {
  throw new Error("ZAMA_RPC_URL is required in .env.");
}

if (!privateKey || !/^(0x)?[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("ZAMA_PRIVATE_KEY must be a 32-byte hex private key in .env.");
}

const provider = new JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();

if (network.chainId !== expectedChainId) {
  throw new Error(
    `Refusing to deploy: expected chain ID ${expectedChainId}, got ${network.chainId}. Set ZAMA_EXPECTED_CHAIN_ID to override.`
  );
}

const wallet = new Wallet(privateKey, provider);
const balance = await provider.getBalance(wallet.address);

console.log(`Deploying Ostra Mem contracts to chain ${network.chainId}.`);
console.log(`Deployer: ${wallet.address}`);
console.log(`Balance: ${formatEther(balance)} ETH`);

for (const item of contracts) {
  if (env[item.envKey] && !force) {
    console.log(`${item.envKey} is already set: ${env[item.envKey]}`);
    console.log("Use npm run contracts:deploy:zama -- --force to redeploy.");
    continue;
  }

  const contract = compiled[item.contractName];
  const factory = new ContractFactory(contract.abi, contract.bytecode, wallet);
  const deployTx = await factory.getDeployTransaction(wallet.address);
  const estimatedGas = await provider.estimateGas({
    ...deployTx,
    from: wallet.address
  });
  console.log(`${item.contractName} estimated deploy gas: ${estimatedGas.toString()}`);

  const instance = await factory.deploy(wallet.address);
  console.log(`${item.contractName} deploy tx: ${instance.deploymentTransaction()?.hash}`);
  await instance.waitForDeployment();

  const address = await instance.getAddress();
  const receipt = await instance.deploymentTransaction()?.wait();
  console.log(`${item.contractName} deployed: ${address}`);

  await writeEnvValue(envPath, item.envKey, address);
  await writeDeploymentArtifact(item.artifactName, {
    contract: item.contractName,
    address,
    chainId: Number(network.chainId),
    deployer: wallet.address,
    txHash: receipt?.hash ?? instance.deploymentTransaction()?.hash,
    blockNumber: receipt?.blockNumber,
    deployedAt: new Date().toISOString()
  });
}

async function compile() {
  const sources = {};
  for (const path of [
    "contracts/ConfidentialMemoryRegistry.sol"
  ]) {
    sources[path] = {
      content: await readFile(join(rootDir, path), "utf8")
    };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true,
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: resolveSolidityImport })
  );
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  }

  const result = {};
  for (const item of contracts) {
    const compiled = output.contracts?.[item.sourceName]?.[item.contractName];
    if (!compiled?.abi || !compiled?.evm?.bytecode?.object) {
      throw new Error(`Failed to compile ${item.contractName}.`);
    }
    result[item.contractName] = {
      abi: compiled.abi,
      bytecode: `0x${compiled.evm.bytecode.object}`
    };
  }
  return result;
}

function resolveSolidityImport(importPath) {
  const candidates = [
    join(rootDir, importPath),
    join(rootDir, "contracts", importPath),
    join(rootDir, "node_modules", importPath)
  ];

  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (existsSync(resolved)) {
      return { contents: readFileSyncUtf8(resolved) };
    }
  }

  return { error: `File not found: ${importPath}` };
}

function readFileSyncUtf8(path) {
  return solcImportReadCache.get(path) ?? readAndCache(path);
}

function readAndCache(path) {
  const content = readFileSync(path, "utf8");
  solcImportReadCache.set(path, content);
  return content;
}

async function readEnv(path) {
  if (!existsSync(path)) return {};
  const raw = await readFile(path, "utf8");
  const env = {};
  for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

async function writeEnvValue(path, key, value) {
  const raw = existsSync(path) ? await readFile(path, "utf8") : "";
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  let updated = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!updated) {
    next.push(`${key}=${value}`);
  }
  await writeFile(path, `${next.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

async function writeDeploymentArtifact(name, artifact) {
  const path = join(rootDir, "contracts", "deployments", name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}
