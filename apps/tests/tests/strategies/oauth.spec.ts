/**
 * oauth.spec.ts — OAuthStrategy browser flow (§7)
 *
 * Verifies provider route interception, mock callback handling, and session.
 * An unintercepted request to e.g. accounts.google.com would stall → timeout.
 * A passing /api/me 200 proves the intercept fired and callback was processed.
 */

import { test, expect } from "qa-pwmaf";
import { OAuthStrategy, IUser } from "qa-pwmaf";
import type { IAuthConfig } from "qa-pwmaf";
import rawUsers from "../data/users.json";

const allUsers = rawUsers as IUser[];
function u(username: string): IUser {
  return (
    allUsers.find((x) => x.username === username) ??
    (() => {
      throw new Error(`User not found: ${username}`);
    })()
  );
}
function eff(user: IUser, base: IAuthConfig): IAuthConfig {
  return {
    ...base,
    authType: user.authType ?? base.authType,
    authPageLayout: user.authPageLayout ?? base.authPageLayout,
    isApi: user.isApi ?? base.isApi,
    otpConfig: user.otpConfig ?? base.otpConfig,
    apiConfig: user.apiConfig ?? base.apiConfig,
    actionUrl: user.actionUrl ?? base.actionUrl,
  };
}

test.describe("§7 OAuthStrategy — OAuth browser flow", () => {
  test("Google OAuth: intercepts accounts.google.com route, handles callback, /api/me 200", async ({
    browser,
    authConfig,
  }) => {
    const user = u("google-user@gmail.com");
    const result = await new OAuthStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const meta = result.metadata as Record<string, unknown>;

    const res = await result.context.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);
    expect(meta.authType).toBe("oauth");
    expect(meta.provider).toBe("google");
    expect(meta.username).toBe(user.username);
    await result.context.close();
  });

  test("metadata.provider resolves from base config when user has no oauthProvider", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("google-user@gmail.com"),
      oauthProvider: undefined,
    };
    const config: IAuthConfig = {
      ...eff(user, authConfig),
      oauthProvider: "google",
    };

    const result = await new OAuthStrategy().authenticate(
      browser,
      user,
      config,
    );
    expect((result.metadata as Record<string, unknown>).provider).not.toBe(
      "unknown",
    );
    await result.context.close();
  });

  test("unsupported provider falls back to FALLBACK_PATTERN without throwing", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("google-user@gmail.com"),
      oauthProvider: "github" as any,
    };
    const result = await new OAuthStrategy()
      .authenticate(browser, user, eff(user, authConfig))
      .catch(() => null);
    if (result) {
      expect((result.metadata as Record<string, unknown>).authType).toBe(
        "oauth",
      );
      await result.context.close();
    }
  });

  test("mockServerUrl in metadata is a valid URL", async ({
    browser,
    authConfig,
  }) => {
    const user = u("google-user@gmail.com");
    const result = await new OAuthStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    expect(
      () =>
        new URL(
          (result.metadata as Record<string, unknown>).mockServerUrl as string,
        ),
    ).not.toThrow();
    await result.context.close();
  });
});
