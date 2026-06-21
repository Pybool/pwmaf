/**
 * email-password.browser.spec.ts — EmailPasswordStrategy browser flows
 *
 * §2  Browser: single-page, progressive-reveal, redirect-throws, wrong-password
 *
 * HOW LAYOUT CORRECTNESS IS VERIFIED
 * ─────────────────────────────────────────────────────────────────────────────
 *  Each mock server port is wired to accept only its specific layout's submission
 *  sequence.  A wrong layout produces a wrong POST body → 401 from /api/me → test
 *  fails.  A passing /api/me proves the strategy executed the correct sequence.
 */

import { test, expect } from "qa-pwmaf";
import { EmailPasswordStrategy, IUser } from "qa-pwmaf";
import rawUsers from "../data/users.json";
import type { IAuthConfig } from "qa-pwmaf";

const allUsers = rawUsers as IUser[];

function u(username: string): IUser {
  const found = allUsers.find((x) => x.username === username);
  if (!found) throw new Error(`User not found: ${username}`);
  return found;
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

test.describe("§2 EmailPasswordStrategy — browser", () => {
  test("single-page: fills email + password together, /api/me returns 200", async ({
    browser,
    authConfig,
  }) => {
    const user = u("user@test.com");
    const config = eff(user, authConfig);
    const result = await new EmailPasswordStrategy().authenticate(
      browser,
      user,
      config,
    );
    const meta = result.metadata as Record<string, unknown>;

    const res = await result.context.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);

    expect(meta.authType).toBe("email-password");
    expect(meta.authPath).toBe("browser");
    expect(meta.username).toBe(user.username);

    await result.context.close();
  });

  test("progressive-reveal: submits email first, waits for password field reveal, then submits", async ({
    browser,
    authConfig,
  }) => {
    const user = u("admin@test.com");
    const result = await new EmailPasswordStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const meta = result.metadata as Record<string, unknown>;

    const res = await result.context.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);

    expect(meta.authType).toBe("email-password");
    expect(meta.authPath).toBe("browser");

    await result.context.close();
  });

  test("redirect-to-new-page layout throws UnsupportedLayoutError", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("user@test.com"),
      authPageLayout: "redirect-to-new-page",
    };
    await expect(
      new EmailPasswordStrategy().authenticate(browser, user, eff(user, authConfig)),
    ).rejects.toThrow(/redirect-to-new-page is Unsupported/i);
  });

  test("wrong password → strategy throws with 4xx status in error message", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("user@test.com"),
      isApi: true,
      password: "WRONG_PASSWORD",
    };
    await expect(
      new EmailPasswordStrategy().authenticate(browser, user, eff(user, authConfig)),
    ).rejects.toThrow(/API auth failed.*4\d\d/i);
  });

  test("metadata.tokenType matches apiConfig.tokenType for cookie users", async ({
    browser,
    authConfig,
  }) => {
    const user = u("user@test.com");
    const result = await new EmailPasswordStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.tokenType).toBe(
      (user.apiConfig ?? authConfig.apiConfig)?.tokenType ?? "cookie",
    );
    await result.context.close();
  });
});
