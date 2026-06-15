import { Browser, BrowserContext } from "@playwright/test";
import { IAuthConfig, IUser, StorageStateMetadata } from "../types";

export interface AuthResult {
  context: BrowserContext;
  metadata?: StorageStateMetadata;
}

export interface IAuthStrategy {
  authenticate(
    browser: Browser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult>;
}
