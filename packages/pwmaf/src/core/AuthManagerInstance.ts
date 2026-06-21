import { createAuthConfig } from "../configs/_auth.config";
import { IAuthConfig } from "../types";
import { AuthManager } from "./AuthManager";
import path from "path";
import fs from "fs/promises";
import { validateConfig } from "../configs";

let authManagerInstance: AuthManager | null = null;

export let authConfig: IAuthConfig;

export async function deleteAuthStore(folderPath: string): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), folderPath);
  try {
    await fs.rm(absolutePath, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    console.info(`Failed to delete auth store: ${absolutePath}`, error);
  }
}

export async function getOrCreateAuthManager(): Promise<AuthManager> {
  if (!authManagerInstance) {
    const _path =
      process.env.AUTH_USERS_FILE ||
      path.resolve(process.cwd(), "src/data/users.json");
    authConfig = await createAuthConfig(_path);

    validateConfig(authConfig);

    if (authConfig.deleteAuthStorageOnTestRun) {
      await deleteAuthStore(authConfig.storageStatePath);
    }

    if (!authConfig.users?.length) {
      throw new Error("No users found in users.json");
    }

    authManagerInstance = new AuthManager(authConfig);
  }
  return authManagerInstance;
}
