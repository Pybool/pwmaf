import fs from "fs";
import path from "path";
import { EnrichedStorageState, TokenStorageConfig } from "../types";

function resolvePath(obj: unknown, dotPath: string): string | null {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : null;
}

function extractFromLocalStorage(
  state: EnrichedStorageState,
  origin: string,
  key: string,
  tokenPath?: string,
): string | null {
  const originEntry = (
    state.origins as Array<{
      origin: string;
      localStorage: Array<{ name: string; value: string }>;
    }>
  ).find((o) => o.origin === origin);

  if (!originEntry) return null;

  const entry = originEntry.localStorage.find((e) => e.name === key);
  if (!entry) return null;

  if (!tokenPath) return entry.value;

  try {
    return resolvePath(JSON.parse(entry.value), tokenPath);
  } catch {
    return entry.value;
  }
}

function extractFromSessionStorage(
  state: EnrichedStorageState,
  origin: string,
  key: string,
  tokenPath?: string,
): string | null {
  if (!state.sessionStorage) return null;

  const originEntries = state.sessionStorage[origin];
  if (!originEntries) return null;

  const value = originEntries[key];
  if (!value) return null;

  if (!tokenPath) return value;

  try {
    return resolvePath(JSON.parse(value), tokenPath);
  } catch {
    return value;
  }
}

export function extractToken(
  state: EnrichedStorageState,
  config: TokenStorageConfig,
  fallbackOrigin?: string,
): string | null {
  const origin = config.origin ?? fallbackOrigin;
  if (!origin) return null;

  if (config.storageType === "localStorage") {
    return extractFromLocalStorage(
      state,
      origin,
      config.storageKey,
      config.tokenPath,
    );
  }

  return extractFromSessionStorage(
    state,
    origin,
    config.storageKey,
    config.tokenPath,
  );
}

export function getTokenFromFile(
  username: string,
  storageStatePath: string,
  config: TokenStorageConfig,
  fallbackOrigin?: string,
): string | null {
  const filePath = path.join(storageStatePath, `${username}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const state = JSON.parse(raw) as EnrichedStorageState;
    return extractToken(state, config, fallbackOrigin);
  } catch {
    return null;
  }
}
