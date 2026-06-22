import { IAuthConfig, IUser, PWBrowser, PWContext, StorageStateMetadata } from "../types";

export interface AuthResult {
  context: PWContext;
  metadata?: StorageStateMetadata;
}

export interface IAuthStrategy {
  authenticate(
    browser: PWBrowser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult>;
}
