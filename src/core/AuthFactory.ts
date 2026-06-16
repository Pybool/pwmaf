import {
  EmailOTPStrategy,
  EmailPasswordOTPStrategy,
  EmailPasswordStrategy,
  OAuthStrategy,
  IAuthStrategy,
  SAMLStrategy,
  OIDCStrategy,
  AuthResult,
} from "../strategeies";
import {
  EnrichedStorageState,
  IAuthConfig,
  IUser,
  PWBrowser,
  PWContext,
  StorageStateMetadata,
} from "../types";
import fs from "fs";
import path from "path";
import { authEvents, SessionSavedPayload } from "./AuthEvents";

export class AuthFactory {
  getStrategy(config: IAuthConfig): IAuthStrategy {
    if (config.customStrategy) return config.customStrategy;

    switch (config.authType) {
      case "email-password":
        return new EmailPasswordStrategy();
      case "email-password-otp":
        return new EmailPasswordOTPStrategy();
      case "email-otp":
        return new EmailOTPStrategy();
      case "oauth":
        return new OAuthStrategy();
      case "oidc":
        return new OIDCStrategy();
      case "saml":
        return new SAMLStrategy();
      default:
        throw new Error(`Unsupported auth type: ${config.authType}`);
    }
  }

  async createSession(
    browser: PWBrowser,
    user: IUser,
    strategy: IAuthStrategy,
    config: IAuthConfig,
  ): Promise<AuthResult> {
    return strategy.authenticate(browser, user, config);
  }

  async saveSession(
    context: PWContext,
    filePath: string,
    metadata: StorageStateMetadata = {},
  ): Promise<void> {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    await context.storageState({ path: filePath });

    const raw = fs.readFileSync(filePath, "utf-8");
    const state = JSON.parse(raw) as EnrichedStorageState;

    const enriched: EnrichedStorageState = {
      ...state,
      metadata: {
        ...state.metadata,
        ...metadata,
        savedAt: new Date().toISOString(),
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2), "utf-8");

    const payload: SessionSavedPayload = {
      filePath,
      enriched,
      userId: metadata.userId as string | undefined,
      authType: metadata.authType as string | undefined,
      savedAt: enriched.metadata!.savedAt as string,
    };

    authEvents.emit("session:saved", payload);
  }

  readSession(filePath: string): EnrichedStorageState | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const state = JSON.parse(raw) as EnrichedStorageState;
      return state;
    } catch {
      return null;
    }
  }

  deleteSession(filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    fs.unlinkSync(filePath);
    authEvents.emit("session:deleted", { filePath });
  }
}
