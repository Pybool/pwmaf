import { createAuthConfig } from "../configs/_auth.config";
import { AuthManager } from "./AuthManager";
import path from "path";


export const authConfig = createAuthConfig(
  process.env.AUTH_USERS_FILE ??
    path.resolve(process.cwd(), "src/data/users.json"),
);

if (!authConfig.users?.length) {
  throw new Error("No users found in users.json");
}

let authManagerInstance: AuthManager | null = null;

export function getOrCreateAuthManager(): AuthManager {
  if (!authManagerInstance) {
    authManagerInstance = new AuthManager(authConfig);
  }
  return authManagerInstance;
}