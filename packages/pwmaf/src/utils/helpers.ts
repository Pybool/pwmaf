import fs from "fs/promises";
import { IUser, PWBrowser, StorageState } from "../types";
import { getOrCreateAuthManager } from "../core/AuthManagerInstance";

export interface TokenExpiryConfig {
  cookieName?: string;
  metadataExpiresAt?: string;
}

export function isTokenExpired(
  storage: StorageState & { metadata?: Record<string, unknown> },
  opts: TokenExpiryConfig = {},
): boolean {
  const cookieName = opts.cookieName ?? "auth_token";
  const authCookie = storage.cookies?.find((c) => c.name === cookieName);

  if (authCookie?.value) {
    try {
      const payload = JSON.parse(
        Buffer.from(authCookie.value.split(".")[1], "base64url").toString(),
      );
      return payload.exp ? Date.now() >= payload.exp * 1000 : true;
    } catch {
      return true;
    }
  }

  // Fallback: check saved metadata timestamp
  const savedAt = storage.metadata?.savedAt as string | undefined;
  const expiresAt = storage.metadata?.expiresAt as string | undefined;
  if (expiresAt) return Date.now() >= new Date(expiresAt).getTime();
  if (savedAt) {
    return Date.now() - new Date(savedAt).getTime() > 60 * 60 * 1000;
  }
  return false;
}

export async function ensureValidSession(username: string, browser: PWBrowser) {
  const file = `.auth/${username}.json`;

  const state = await fs.readFile(file, "utf-8").catch(() => null);

  if (!state) {
    const authManager = await getOrCreateAuthManager();
    await authManager.reauthenticateUser(username, browser);
    return;
  }

  const parsed = JSON.parse(state);

  if (isTokenExpired(parsed)) {
    await fs.rm(file, { force: true });
    const authManager = await getOrCreateAuthManager();
    await authManager.reauthenticateUser(username, browser);
  }
}

export function buildApiUrl(baseUrl: string, path?: string): string {
  if (!baseUrl) {
    throw new Error("actionUrl is required when using API authentication");
  }

  try {
    const url = new URL(baseUrl);

    // Prevent d actionUrl from containinng endpoint path
    if (path && url.pathname !== "/") {
      throw new Error(
        [
          `Invalid API auth configuration.`,
          `actionUrl should contain only origin.`,
          `Received: "${baseUrl}"`,
          `Move endpoint into apiConfig.path.`,
        ].join(" "),
      );
    }

    if (path) {
      url.pathname = path.startsWith("/") ? path : `/${path}`;
    }

    return url.toString();
  } catch (err) {
    throw new Error(
      `Invalid API authentication URL configuration: ${(err as Error).message}`,
    );
  }
}

export function authFile(username: string) {
  return `.auth/${username}.json`;
}

export async function validateUserEndpoints(users: IUser[]) {
  for (const user of users) {
    if (!user.actionUrl) {
      throw new Error(`Missing actionUrl for user ${user.username}`);
    }

    try {
      const response = await fetch(user.actionUrl);
      if (!response.ok) {
        throw new Error(`Received ${response.status} from ${user.actionUrl}`);
      }
      console.log(`[globalSetup] ${user.username} -> ${user.actionUrl} [OK]`);
    } catch (error) {
      throw new Error(
        `Failed to reach ${user.actionUrl} for user ${user.username}: ${error}`,
      );
    }
  }
}
