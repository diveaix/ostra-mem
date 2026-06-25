import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  JsonFileStorage,
  ZeroGMem,
  type AgentProfile,
  type ContextResult,
  type MemoryInput,
  type MemoryRecord,
  type TradePlan,
  type ZeroGMemConfig
} from "@0g-mem/sdk";
import { AuthError, JsonAuthStore, type AuthPrincipal } from "./auth.js";

export type ApiOptions = {
  sdk?: ZeroGMem;
  config?: ZeroGMemConfig;
  memoryPath?: string;
  authPath?: string;
  auth?: {
    appUrl?: string;
    returnDevVerificationToken?: boolean;
  };
};

type ApiContext = {
  sdk: ZeroGMem;
  auth: JsonAuthStore;
  appUrl: string;
  returnDevVerificationToken: boolean;
};

type HeaderValue = string | number | readonly string[];

const SESSION_COOKIE = "ogmem_session";
const DEFAULT_APP_URL = "http://127.0.0.1:5173";

export function create0GMemApi(options: ApiOptions = {}) {
  const sdk =
    options.sdk ??
    new ZeroGMem(
      options.config ?? {},
      new JsonFileStorage(options.memoryPath ?? ".0g-mem/api-memory.json")
    );
  const context: ApiContext = {
    sdk,
    auth: new JsonAuthStore(
      options.authPath ?? process.env.OG_MEM_API_AUTH_PATH ?? ".0g-mem/auth.json"
    ),
    appUrl: options.auth?.appUrl ?? process.env.OG_MEM_APP_URL ?? DEFAULT_APP_URL,
    returnDevVerificationToken:
      options.auth?.returnDevVerificationToken ??
      process.env.OG_MEM_RETURN_DEV_TOKENS !== "false"
  };

  return createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        sendEmpty(request, response, 204);
        return;
      }
      await routeRequest(context, request, response);
    } catch (error) {
      const statusCode = error instanceof AuthError ? error.statusCode : 500;
      sendJson(request, response, statusCode, {
        error: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });
}

async function routeRequest(
  context: ApiContext,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = normalizePath(url.pathname);
  const method = request.method ?? "GET";

  if (method === "GET" && path === "/health") {
    sendJson(request, response, 200, { ok: true, service: "0g-mem-api" });
    return;
  }

  if (method === "POST" && path === "/auth/request-login") {
    const body = await readJson<{ email: string }>(request);
    const result = await context.auth.requestLogin({
      email: body.email,
      verificationBaseUrl: requestOrigin(request)
    });
    sendJson(request, response, 200, {
      ok: true,
      email: result.user.email,
      verificationUrl: result.verificationUrl,
      devVerificationToken: context.returnDevVerificationToken
        ? result.verificationToken
        : undefined
    });
    return;
  }

  if (method === "POST" && path === "/auth/verify") {
    const body = await readJson<{ token: string }>(request);
    const result = await context.auth.verifyEmail(body.token);
    sendJson(
      request,
      response,
      200,
      {
        user: publicUser(result.user)
      },
      {
        "Set-Cookie": makeSessionCookie(result.sessionToken)
      }
    );
    return;
  }

  if (method === "GET" && path === "/auth/verify") {
    const token = url.searchParams.get("token");
    if (!token) {
      throw new AuthError("Verification token is required", 400);
    }

    const result = await context.auth.verifyEmail(token);
    sendRedirect(request, response, `${context.appUrl.replace(/\/$/, "")}/#dashboard`, {
      "Set-Cookie": makeSessionCookie(result.sessionToken)
    });
    return;
  }

  if (method === "GET" && path === "/auth/me") {
    const principal = await requireSession(context, request);
    const apiKeys = await context.auth.listApiKeys(principal.user.id);
    sendJson(request, response, 200, {
      user: publicUser(principal.user),
      apiKeys
    });
    return;
  }

  if (method === "POST" && path === "/auth/logout") {
    await context.auth.revokeSession(readSessionCookie(request));
    sendJson(
      request,
      response,
      200,
      { ok: true },
      {
        "Set-Cookie": clearSessionCookie()
      }
    );
    return;
  }

  if (method === "GET" && path === "/api-keys") {
    const principal = await requireSession(context, request);
    const apiKeys = await context.auth.listApiKeys(principal.user.id);
    sendJson(request, response, 200, { apiKeys });
    return;
  }

  if (method === "POST" && path === "/api-keys") {
    const principal = await requireSession(context, request);
    const body = await readJson<{ name?: string; scopes?: string[] }>(request);
    const result = await context.auth.createApiKey({
      userId: principal.user.id,
      name: body.name ?? "Trading agent key",
      scopes: body.scopes
    });
    sendJson(request, response, 201, {
      apiKey: result.apiKey,
      secret: result.secret
    });
    return;
  }

  const apiKeyMatch = /^\/api-keys\/([^/]+)$/.exec(path);
  if (method === "DELETE" && apiKeyMatch) {
    const principal = await requireSession(context, request);
    const apiKey = await context.auth.revokeApiKey(
      principal.user.id,
      decodeURIComponent(apiKeyMatch[1])
    );
    sendJson(request, response, 200, { apiKey });
    return;
  }

  if (method === "POST" && path === "/memory") {
    const principal = await requirePrincipal(context, request);
    const body = await readJson<MemoryInput>(request);
    const memory = await context.sdk.ogmem.memory.add(scopeMemoryInput(principal, body));
    sendJson(request, response, 201, {
      memory: unScopeMemoryRecord(principal, memory)
    });
    return;
  }

  if (method === "GET" && path === "/memory") {
    const principal = await requirePrincipal(context, request);
    const agentId = url.searchParams.get("agentId");
    if (!agentId) {
      const query = url.searchParams.get("query")?.toLowerCase().trim();
      const limit = Number(url.searchParams.get("limit") ?? "100");
      const prefix = `${principal.user.id}:`;
      const memories = (await context.sdk.ogmem.memory.listAll())
        .filter((memory) => memory.agentId.startsWith(prefix))
        .filter((memory) => !query || memoryMatchesQuery(memory, query))
        .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 100);
      sendJson(request, response, 200, {
        memories: memories.map((memory) => unScopeMemoryRecord(principal, memory))
      });
      return;
    }

    const memories = await context.sdk.ogmem.memory.search({
      agentId: scopeAgentId(principal, agentId),
      query: url.searchParams.get("query") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? "10")
    });
    sendJson(request, response, 200, {
      memories: memories.map((memory) => unScopeMemoryRecord(principal, memory))
    });
    return;
  }

  const memoryMatch = /^\/memory\/([^/]+)$/.exec(path);
  if (method === "DELETE" && memoryMatch) {
    const principal = await requirePrincipal(context, request);
    const memoryId = decodeURIComponent(memoryMatch[1]);
    const memory = (await context.sdk.ogmem.memory.listAll()).find(
      (item) => item.id === memoryId
    );
    if (!memory || !memory.agentId.startsWith(`${principal.user.id}:`)) {
      sendJson(request, response, 404, { error: "Memory not found" });
      return;
    }
    const deleted = await context.sdk.ogmem.memory.delete(memoryId);
    sendJson(request, response, 200, {
      memory: deleted ? unScopeMemoryRecord(principal, deleted) : undefined
    });
    return;
  }

  if (method === "GET" && path === "/profile") {
    const principal = await requirePrincipal(context, request);
    const agentId = url.searchParams.get("agentId");
    if (!agentId) {
      sendJson(request, response, 400, { error: "agentId query param is required" });
      return;
    }

    const profile = await context.sdk.ogmem.profile.get({
      agentId: scopeAgentId(principal, agentId),
      query: url.searchParams.get("query") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? "10")
    });
    sendJson(request, response, 200, {
      profile: unScopeProfile(principal, profile)
    });
    return;
  }

  if (method === "POST" && path === "/context") {
    const principal = await requirePrincipal(context, request);
    const plan = await readJson<TradePlan>(request);
    const contextResult = await context.sdk.ogmem.context.forTradePlan(
      scopeTradePlan(principal, plan)
    );
    sendJson(request, response, 200, {
      context: unScopeContext(principal, contextResult)
    });
    return;
  }

  if (method === "POST" && path === "/review-plan") {
    const principal = await requirePrincipal(context, request);
    const plan = scopeTradePlan(principal, await readJson<TradePlan>(request));
    const contextResult = await context.sdk.ogmem.context.forTradePlan(plan);
    const verdict = await context.sdk.aegis.risk.reviewPlan({
      ...plan,
      context: contextResult
    });
    const proof = await context.sdk.proofs.recordDecision({
      agentId: plan.agentId,
      planHash: verdict.planHash,
      reportHash: verdict.reportHash,
      decision: verdict.decision
    });
    sendJson(request, response, 200, {
      context: unScopeContext(principal, contextResult),
      verdict,
      proof
    });
    return;
  }

  if (method === "POST" && path === "/trades/outcome") {
    const principal = await requirePrincipal(context, request);
    const body = await readJson<{
      agentId: string;
      planId: string;
      txHashes: string[];
      status: "executed" | "failed" | "reverted" | "skipped";
      pnlUsd?: number;
      reason?: string;
      notes?: string;
    }>(request);
    const outcome = await context.sdk.trades.recordOutcome({
      ...body,
      agentId: scopeAgentId(principal, body.agentId)
    });
    sendJson(request, response, 201, {
      outcome: unScopeMemoryRecord(principal, outcome)
    });
    return;
  }

  if (method === "POST" && path === "/learning/reflect") {
    const principal = await requirePrincipal(context, request);
    const body = await readJson<{ agentId: string; planId: string }>(request);
    const lesson = await context.sdk.learning.reflect({
      ...body,
      agentId: scopeAgentId(principal, body.agentId)
    });
    sendJson(request, response, 201, {
      lesson: unScopeMemoryRecord(principal, lesson)
    });
    return;
  }

  sendJson(request, response, 404, { error: "Not found" });
}

async function requireSession(
  context: ApiContext,
  request: IncomingMessage
): Promise<AuthPrincipal> {
  const principal = await context.auth.authenticateSession(readSessionCookie(request));
  if (!principal) {
    throw new AuthError("Login required", 401);
  }
  return principal;
}

async function requirePrincipal(
  context: ApiContext,
  request: IncomingMessage
): Promise<AuthPrincipal> {
  const bearer = readBearerToken(request);
  const apiPrincipal = await context.auth.authenticateApiKey(bearer);
  if (apiPrincipal) {
    return apiPrincipal;
  }

  const sessionPrincipal = await context.auth.authenticateSession(readSessionCookie(request));
  if (sessionPrincipal) {
    return sessionPrincipal;
  }

  throw new AuthError("API key or login session required", 401);
}

function scopeMemoryInput(principal: AuthPrincipal, input: MemoryInput): MemoryInput {
  return {
    ...input,
    agentId: scopeAgentId(principal, input.agentId)
  };
}

function scopeTradePlan(principal: AuthPrincipal, plan: TradePlan): TradePlan {
  return {
    ...plan,
    agentId: scopeAgentId(principal, plan.agentId)
  };
}

function scopeAgentId(principal: AuthPrincipal, agentId: string): string {
  return `${principal.user.id}:${agentId}`;
}

function unScopeAgentId(principal: AuthPrincipal, agentId: string): string {
  const prefix = `${principal.user.id}:`;
  return agentId.startsWith(prefix) ? agentId.slice(prefix.length) : agentId;
}

function unScopeMemoryRecord(principal: AuthPrincipal, memory: MemoryRecord): MemoryRecord {
  return {
    ...memory,
    agentId: unScopeAgentId(principal, memory.agentId)
  };
}

function unScopeProfile(principal: AuthPrincipal, profile: AgentProfile): AgentProfile {
  return {
    ...profile,
    agentId: unScopeAgentId(principal, profile.agentId),
    static: profile.static.map((memory) => unScopeMemoryRecord(principal, memory)),
    dynamic: profile.dynamic.map((memory) => unScopeMemoryRecord(principal, memory)),
    searchResults: profile.searchResults.map((memory) =>
      unScopeMemoryRecord(principal, memory)
    )
  };
}

function unScopeContext(principal: AuthPrincipal, context: ContextResult): ContextResult {
  return {
    ...context,
    memories: context.memories.map((memory) => unScopeMemoryRecord(principal, memory))
  };
}

function memoryMatchesQuery(memory: MemoryRecord, query: string): boolean {
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
    .filter((token) => token.length > 1)
    .every((token) => haystack.includes(token));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new Error("Expected JSON body");
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function normalizePath(pathname: string): string {
  return pathname.startsWith("/v1/") ? pathname.slice(3) : pathname;
}

function publicUser(user: { id: string; email: string; emailVerifiedAt?: string }) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt
  };
}

function readBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }
  return header.slice("Bearer ".length).trim();
}

function requestOrigin(request: IncomingMessage): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto ?? "http";
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost ?? request.headers.host ?? "localhost";
  return `${proto}://${host}`;
}

function readSessionCookie(request: IncomingMessage): string | undefined {
  return parseCookies(request.headers.cookie)[SESSION_COOKIE];
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...value] = part.split("=");
        return [name, decodeURIComponent(value.join("="))];
      })
  );
}

function makeSessionCookie(sessionToken: string): string {
  const sameSite = process.env.OG_MEM_COOKIE_SAMESITE ?? "Lax";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    "Max-Age=604800"
  ];
  if (process.env.OG_MEM_COOKIE_SECURE === "true") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function clearSessionCookie(): string {
  const sameSite = process.env.OG_MEM_COOKIE_SAMESITE ?? "Lax";
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    "Max-Age=0"
  ];
  if (process.env.OG_MEM_COOKIE_SECURE === "true") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, HeaderValue> = {}
): void {
  writeCorsHeaders(request, response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendRedirect(
  request: IncomingMessage,
  response: ServerResponse,
  location: string,
  headers: Record<string, HeaderValue> = {}
): void {
  writeCorsHeaders(request, response);
  response.writeHead(302, {
    Location: location,
    ...headers
  });
  response.end();
}

function sendEmpty(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number
): void {
  writeCorsHeaders(request, response);
  response.writeHead(statusCode);
  response.end();
}

function writeCorsHeaders(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  response.setHeader("Access-Control-Allow-Origin", origin ?? "*");
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
