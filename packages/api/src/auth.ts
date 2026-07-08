import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { dirname } from "node:path";

export type User = {
  id: string;
  email: string;
  createdAt: string;
  emailVerifiedAt?: string;
};

export type EmailVerificationToken = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export type Session = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type ApiKeyRecord = {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type PublicApiKey = Omit<ApiKeyRecord, "keyHash">;

export type AuthState = {
  users: User[];
  emailVerificationTokens: EmailVerificationToken[];
  sessions: Session[];
  apiKeys: ApiKeyRecord[];
};

export type AuthPrincipal = {
  user: User;
  apiKey?: PublicApiKey;
  session?: Session;
  kind: "apiKey" | "session";
};

const DEFAULT_AUTH_STATE: AuthState = {
  users: [],
  emailVerificationTokens: [],
  sessions: [],
  apiKeys: []
};

const EMAIL_TOKEN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class JsonAuthStore {
  private state: AuthState | undefined;

  constructor(private readonly filePath = ".ostra-mem/auth.json") {}

  async requestLogin(input: {
    email: string;
    verificationBaseUrl: string;
  }): Promise<{ user: User; verificationToken: string; verificationUrl: string }> {
    const state = await this.load();
    const email = normalizeEmail(input.email);
    const now = new Date();
    let user = state.users.find((item) => item.email === email);

    if (!user) {
      user = {
        id: createId("user"),
        email,
        createdAt: now.toISOString()
      };
      state.users.push(user);
    }

    const verificationToken = `ogm_verify_${randomToken(32)}`;
    const tokenRecord: EmailVerificationToken = {
      id: createId("evt"),
      userId: user.id,
      tokenHash: hashSecret(verificationToken),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + EMAIL_TOKEN_TTL_MS).toISOString()
    };
    state.emailVerificationTokens.push(tokenRecord);
    await this.persist();

    const verificationUrl = makeVerificationUrl(input.verificationBaseUrl, verificationToken);
    return { user, verificationToken, verificationUrl };
  }

  async verifyEmail(token: string): Promise<{ user: User; session: Session; sessionToken: string }> {
    const state = await this.load();
    const tokenHash = hashSecret(token);
    const now = new Date();
    const tokenRecord = state.emailVerificationTokens.find(
      (item) =>
        item.tokenHash === tokenHash &&
        !item.usedAt &&
        new Date(item.expiresAt).getTime() > now.getTime()
    );

    if (!tokenRecord) {
      throw new AuthError("Invalid or expired verification token", 401);
    }

    const user = state.users.find((item) => item.id === tokenRecord.userId);
    if (!user) {
      throw new AuthError("Verification token user was not found", 401);
    }

    tokenRecord.usedAt = now.toISOString();
    user.emailVerifiedAt = user.emailVerifiedAt ?? now.toISOString();

    const sessionToken = `ogm_session_${randomToken(32)}`;
    const session: Session = {
      id: createId("sess"),
      userId: user.id,
      tokenHash: hashSecret(sessionToken),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString()
    };
    state.sessions.push(session);
    await this.persist();

    return { user, session, sessionToken };
  }

  async authenticateSession(sessionToken: string | undefined): Promise<AuthPrincipal | undefined> {
    if (!sessionToken) return undefined;

    const state = await this.load();
    const session = state.sessions.find(
      (item) =>
        item.tokenHash === hashSecret(sessionToken) &&
        !item.revokedAt &&
        new Date(item.expiresAt).getTime() > Date.now()
    );
    if (!session) return undefined;

    const user = state.users.find((item) => item.id === session.userId);
    if (!user?.emailVerifiedAt) return undefined;

    return { user, session, kind: "session" };
  }

  async revokeSession(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;

    const state = await this.load();
    const session = state.sessions.find((item) => item.tokenHash === hashSecret(sessionToken));
    if (session && !session.revokedAt) {
      session.revokedAt = new Date().toISOString();
      await this.persist();
    }
  }

  async createApiKey(input: {
    userId: string;
    name: string;
    scopes?: string[];
  }): Promise<{ apiKey: PublicApiKey; secret: string }> {
    const state = await this.load();
    const user = state.users.find((item) => item.id === input.userId);
    if (!user?.emailVerifiedAt) {
      throw new AuthError("Email must be verified before creating API keys", 403);
    }

    const secret = `ogm_live_${randomToken(32)}`;
    const apiKey: ApiKeyRecord = {
      id: createId("key"),
      userId: input.userId,
      name: input.name.trim() || "Trading agent key",
      prefix: secret.slice(0, 17),
      keyHash: hashSecret(secret),
      scopes: input.scopes?.length ? input.scopes : ["memory:read", "memory:write"],
      createdAt: new Date().toISOString()
    };
    state.apiKeys.push(apiKey);
    await this.persist();

    return { apiKey: publicApiKey(apiKey), secret };
  }

  async listApiKeys(userId: string): Promise<PublicApiKey[]> {
    const state = await this.load();
    return state.apiKeys
      .filter((item) => item.userId === userId)
      .map(publicApiKey)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async revokeApiKey(userId: string, id: string): Promise<PublicApiKey> {
    const state = await this.load();
    const apiKey = state.apiKeys.find((item) => item.userId === userId && item.id === id);
    if (!apiKey) {
      throw new AuthError("API key not found", 404);
    }

    apiKey.revokedAt = apiKey.revokedAt ?? new Date().toISOString();
    await this.persist();
    return publicApiKey(apiKey);
  }

  async authenticateApiKey(secret: string | undefined): Promise<AuthPrincipal | undefined> {
    if (!secret) return undefined;

    const state = await this.load();
    const apiKey = state.apiKeys.find(
      (item) => item.keyHash === hashSecret(secret) && !item.revokedAt
    );
    if (!apiKey) return undefined;

    const user = state.users.find((item) => item.id === apiKey.userId);
    if (!user?.emailVerifiedAt) return undefined;

    apiKey.lastUsedAt = new Date().toISOString();
    await this.persist();

    return {
      user,
      apiKey: publicApiKey(apiKey),
      kind: "apiKey"
    };
  }

  private async load(): Promise<AuthState> {
    if (this.state) return this.state;

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = normalizeAuthState(JSON.parse(stripBom(raw)));
      return this.state;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        this.state = structuredClone(DEFAULT_AUTH_STATE);
        return this.state;
      }
      throw error;
    }
  }

  private async persist(): Promise<void> {
    const state = await this.load();
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`);
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode = 401
  ) {
    super(message);
  }
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+.[^@\s]+$/.test(normalized)) {
    throw new AuthError("A valid email address is required", 400);
  }
  return normalized;
}

function normalizeAuthState(value: unknown): AuthState {
  if (!isRecord(value)) return structuredClone(DEFAULT_AUTH_STATE);
  return {
    users: Array.isArray(value.users) ? value.users.filter(isUser) : [],
    emailVerificationTokens: Array.isArray(value.emailVerificationTokens)
      ? value.emailVerificationTokens.filter(isEmailVerificationToken)
      : [],
    sessions: Array.isArray(value.sessions) ? value.sessions.filter(isSession) : [],
    apiKeys: Array.isArray(value.apiKeys) ? value.apiKeys.filter(isApiKeyRecord) : []
  };
}

function publicApiKey(apiKey: ApiKeyRecord): PublicApiKey {
  const { keyHash: _keyHash, ...safeApiKey } = apiKey;
  return safeApiKey;
}

function makeVerificationUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/auth/verify?token=${encodeURIComponent(token)}`;
}

function createId(prefix: string): string {
  return `${prefix}_${randomToken(16)}`;
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function isUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.createdAt === "string"
  );
}

function isEmailVerificationToken(value: unknown): value is EmailVerificationToken {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    typeof value.tokenHash === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    typeof value.tokenHash === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

function isApiKeyRecord(value: unknown): value is ApiKeyRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    typeof value.name === "string" &&
    typeof value.prefix === "string" &&
    typeof value.keyHash === "string" &&
    Array.isArray(value.scopes) &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
