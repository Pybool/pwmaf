/**
 * custom-strategy.spec.ts — customStrategy extension point (§21)
 *
 * §1  AuthFactory returns the custom instance verbatim — authType ignored
 * §2  authenticate() is called with correct browser, user, config arguments
 * §3  Working custom strategy produces a valid session (/api/me 200)
 * §4  Custom metadata is preserved through AuthFactory.saveSession()
 */

import fs from "fs";
import { test, expect } from "qa-pwmaf";
import { AuthFactory, authFile, IAuthStrategy, IUser } from "qa-pwmaf";
import type { IAuthConfig } from "qa-pwmaf";
import rawUsers from "../data/users.json";

const allUsers = rawUsers as IUser[];
function u(n: string): IUser {
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

test.describe("§21 customStrategy — real IAuthStrategy extension point", () => {
  test("AuthFactory returns customStrategy regardless of authType", ({
    authConfig,
  }) => {
    const custom: IAuthStrategy = {
      authenticate: async () => ({ context: null as any }),
    };
    for (const authType of [
      "email-password",
      "email-otp",
      "oauth",
      "oidc",
      "saml",
    ] as const) {
      expect(
        new AuthFactory().getStrategy({
          ...authConfig,
          authType,
          customStrategy: custom,
        }),
      ).toBe(custom);
    }
  });

  test("authenticate() is called with browser, user, and config arguments", async ({
    browser,
    authConfig,
  }) => {
    const user = u("user@test.com");
    const captured: { user: IUser | null; config: IAuthConfig | null } = {
      user: null,
      config: null,
    };

    const custom: IAuthStrategy = {
      authenticate: async (b, u, c) => {
        captured.user = u;
        captured.config = c;
        const ctx = await b.newContext();
        await ctx.request.post(`${u.actionUrl}/auth/login`, {
          data: { email: u.username, password: u.password },
        });
        return {
          context: ctx,
          metadata: { authType: "custom", authPath: "custom" },
        };
      },
    };

    const config: IAuthConfig = {
      ...eff(user, authConfig),
      customStrategy: custom,
    };
    await custom
      .authenticate(browser, user, config)
      .then((r) => r.context.close());

    expect(captured.user?.username).toBe(user.username);
    expect(captured.config?.customStrategy).toBe(custom);
  });

  test("working custom strategy: direct API login → /api/me returns 200", async ({
    browser,
    authConfig,
  }) => {
    const user = u("user@test.com");

    const apiLoginStrategy: IAuthStrategy = {
      authenticate: async (b, u) => {
        const ctx = await b.newContext();
        const res = await ctx.request.post(`${u.actionUrl}/auth/login`, {
          data: { email: u.username, password: u.password },
        });
        if (!res.ok()) {
          await ctx.close();
          throw new Error(`Login failed: ${res.status()}`);
        }
        return {
          context: ctx,
          metadata: {
            authType: "custom",
            authPath: "custom-api",
            username: u.username,
          },
        };
      },
    };

    const config: IAuthConfig = {
      ...eff(user, authConfig),
      customStrategy: apiLoginStrategy,
    };
    const result = await apiLoginStrategy.authenticate(browser, user, config);
    const meta = result.metadata as Record<string, unknown>;

    const res = await result.context.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);
    expect(meta.authPath).toBe("custom-api");
    await result.context.close();
  });

  test("custom metadata is preserved in AuthFactory.saveSession() output", async ({
    browser,
    authConfig,
  }) => {
    const user = u("user@test.com");
    const factory = new AuthFactory();

    const custom: IAuthStrategy = {
      authenticate: async (b, u) => {
        const ctx = await b.newContext();
        await ctx.request.post(`${u.actionUrl}/auth/login`, {
          data: { email: u.username, password: u.password },
        });
        return {
          context: ctx,
          metadata: { authType: "custom", customField: "preserved-value" },
        };
      },
    };

    const result = await custom.authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const savePath = authFile("__custom_test__");

    await factory.saveSession(result.context, savePath, result.metadata ?? {});

    const saved = JSON.parse(fs.readFileSync(savePath, "utf-8"));
    expect(saved.metadata.customField).toBe("preserved-value");
    expect(saved.metadata.authType).toBe("custom");

    await result.context.close();
    if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
  });
});
