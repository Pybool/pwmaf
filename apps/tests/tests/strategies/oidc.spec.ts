/**
 * oidc.spec.ts — OIDCStrategy browser flow (§8)
 */

import { test, expect } from "qa-pwmaf";
import { OIDCStrategy, IUser } from "qa-pwmaf";
import type { IAuthConfig } from "qa-pwmaf";
import rawUsers from "../data/users.json";

const allUsers = rawUsers as IUser[];
function u(n: string) {
  return (
    allUsers.find((x) => x.username === n) ??
    (() => {
      throw new Error(n);
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

test.describe("§8 OIDCStrategy — OIDC browser flow", () => {
  test("okta: SSO button click intercepted, callback handled, session established", async ({
    browser,
    authConfig,
  }) => {
    const user = u("oidc-user@example.com");
    const result = await new OIDCStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const meta = result.metadata as Record<string, unknown>;

    const res = await result.context.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);
    expect(meta.authType).toBe("oidc");
    expect(meta.provider).toBe("okta");
    expect(meta.username).toBe(user.username);
    await result.context.close();
  });

  test("metadata.mockServerUrl is a valid URL", async ({
    browser,
    authConfig,
  }) => {
    const user = u("oidc-user@example.com");
    const result = await new OIDCStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const meta = result.metadata as Record<string, unknown>;
    expect(() => new URL(meta.mockServerUrl as string)).not.toThrow();
    await result.context.close();
  });
});
