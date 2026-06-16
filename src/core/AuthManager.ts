import {
  EnrichedStorageState,
  IAuthConfig,
  IUser,
  PWBrowser,
  PWContext,
  StorageState,
  StorageStateMetadata,
} from "../types";
import { AuthFactory } from "./AuthFactory";
import { isTokenExpired } from "../utils/helpers";
import { authEvents } from "./AuthEvents";
import fs from "fs";

export class AuthManager {
  private factory: AuthFactory;
  private browser!: PWBrowser;
  private userContexts = new Map<string, PWContext>();

  constructor(private config: IAuthConfig) {
    this.factory = new AuthFactory();
  }

  private buildEffectiveConfig(user: IUser): IAuthConfig {
    return {
      ...this.config,
      authType: user.authType ?? this.config.authType,
      authPageLayout: user.authPageLayout ?? this.config.authPageLayout,
      isApi: user.isApi ?? this.config.isApi,
      otpConfig: user.otpConfig ?? this.config.otpConfig,
      apiConfig: user.apiConfig ?? this.config.apiConfig,
      actionUrl: user.actionUrl ?? this.config.actionUrl,
    };
  }

  private async authenticateWithRetry(
    browser: PWBrowser,
    user: IUser,
    effectiveConfig: IAuthConfig,
    maxRetries = 2,
  ): Promise<{
    context: PWContext;
    metadata?: StorageStateMetadata;
  }> {
    const strategy = this.factory.getStrategy(effectiveConfig);

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await strategy.authenticate(browser, user, effectiveConfig);
      } catch (error) {
        lastError = error;

        if (attempt > maxRetries) {
          break;
        }

        console.warn(
          `[Auth Retry ${attempt}/${maxRetries}] Failed for ${user.username}`,
        );

        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    throw lastError;
  }

  private async authenticateUser(
    browser: PWBrowser,
    user: IUser,
  ): Promise<PWContext> {
    const effectiveConfig = this.buildEffectiveConfig(user);

    const { context, metadata } = await this.authenticateWithRetry(
      browser,
      user,
      effectiveConfig,
      this.config.maxAuthRetries ?? 2,
    );

    await this.factory.saveSession(
      context,
      `${this.config.storageStatePath}/${user.username}.json`,
      metadata ?? {},
    );

    return context;
  }

  async setup(browser: PWBrowser): Promise<void> {
    this.browser = browser;
    if (!this.config.users.length) {
      throw new Error("At least one user must be configured");
    }

    const authenticate = async (user: IUser) => {
      const context = await this.authenticateUser(browser, user);

      console.log("Set new user context for ", user.username);
      this.userContexts.set(user.username, context);
      await context.close();
    };

    if (this.config.rateLimited) {
      for (const user of this.config.users) {
        await authenticate(user);
        await new Promise((r) => setTimeout(r, 500));
      }
    } else {
      await Promise.all(this.config.users.map(authenticate));
    }
  }
  async reauthenticateUser(
    username: string,
    browser: PWBrowser,
  ): Promise<PWContext> {
    console.log("reauthenticateUser caslled ===> ");
    const user = this.config.users.find((u) => u.username === username);

    if (!user) {
      throw new Error(`User "${username}" not found`);
    }

    const existing = this.userContexts.get(username);

    if (existing) {
      await existing.close();
      this.userContexts.delete(username);
    }

    this.factory.deleteSession(
      `${this.config.storageStatePath}/${username}.json`,
    );

    const context = await this.authenticateUser(browser, user);
    this.userContexts.set(username, context);
    return context;
  }

  async getContext(
    username: string,
    browser: PWBrowser,
  ): Promise<PWContext> {
    const storagePath = `${this.config.storageStatePath}/${username}.json`;
    return fs.existsSync(storagePath)
      ? browser.newContext({ storageState: storagePath })
      : browser.newContext();
  }

  get authConfig(): IAuthConfig {
    return this.config;
  }

  getUserEffectiveConfig(username: string): IAuthConfig {
    const user = this.config.users.find((u) => u.username === username);
    if (!user) return this.config;
    return this.buildEffectiveConfig(user);
  }

  async readSession(username: string): Promise<EnrichedStorageState | null> {
    const context = this.userContexts.get(username);
    if (context) {
      await context.close();
      this.userContexts.delete(username);
    }
    const filePath = `${this.config.storageStatePath}/${username}.json`;
    let state = await this.factory.readSession(filePath);
    if (!state) {
      throw new Error(
        `[AuthManager] Session file missing or unreadable for "${username}" at "${filePath}". ` +
        `Run global setup first or add the user to users.json.`,
      );
    }
    const isExpired = isTokenExpired(state as StorageState);
    if (isExpired) {
      await this.reauthenticateUser(username, this.browser);
      state = await this.factory.readSession(filePath);

      if (!state) {
        throw new Error(`Reauthentication failed for "${username}"`);
      }
    }
    authEvents.emit("session:read", { filePath, state });

    return state;
  }

  async logoutSession(username: string): Promise<void> {
    const context = this.userContexts.get(username);
    if (context) {
      await context.close();
      this.userContexts.delete(username);
    }

    const filePath = `${this.config.storageStatePath}/${username}.json`;
    this.factory.deleteSession(filePath);
  }

  async teardown(): Promise<void> {
  const entries = Array.from(this.userContexts.entries());

  await Promise.all(
    entries.map(async ([username, context]) => {
      try {
        await context.close();
        await this.logoutSession(username);

        console.log(
          `[Teardown] Closed context for ${username}`,
        );
      } catch (err) {
        console.error(
          `[Teardown] Failed for ${username}`,
          err,
        );
      }
    }),
  );

  this.userContexts.clear();
}
}
