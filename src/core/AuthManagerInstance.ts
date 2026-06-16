import { createAuthConfig } from "../configs/_auth.config";
import { IAuthConfig } from "../types";
import { AuthManager } from "./AuthManager";
import path from "path";

let authManagerInstance: AuthManager | null = null;

export let authConfig: IAuthConfig;

export function getOrCreateAuthManager(): AuthManager {
  if (!authManagerInstance) {
    const _path = process.env.AUTH_USERS_FILE || path.resolve(process.cwd(), "src/data/users.json");
    authConfig = createAuthConfig(_path);

    if (!authConfig.users?.length) {
      throw new Error("No users found in users.json");
    }

    authManagerInstance = new AuthManager(authConfig);
  }
  return authManagerInstance;
}