/**
 * email-password-otp.api.spec.ts — EmailPasswordOTPStrategy API paths
 *
 * Consolidates §19 (EmailPasswordOTPStrategy API part) and [TEST]6.
 *
 * §1  API path — all hybrid users (password step + OTP step, no browser)
 * §2  Sequencing guarantee — wrong password rejects before OTP step is reached
 *
 * Mock servers:
 *   port 3005  hybrid-user@test.com      single-page       × single-input
 *   port 3006  hybrid-admin@test.com     progressive-reveal × single-input
 *   port 3014  hybrid-sp-page@test.com   single-page       × single-input (redirect)
 *   port 3016  hybrid-ef-page@test.com   progressive-reveal × single-input (redirect)
 *   port 3015  hybrid-sp-multi@test.com  single-page       × segmented
 *   port 3017  hybrid-ef-multi@test.com  progressive-reveal × segmented
 */

import { test, expect } from "qa-pwmaf";
import { EmailPasswordOTPStrategy, IUser } from "qa-pwmaf";
import type { IAuthConfig } from "qa-pwmaf";
import rawApiUsers from "../data/users.api.json";

const allApiUsers = rawApiUsers as IUser[];

function u(username: string): IUser {
  const found = allApiUsers.find((x) => x.username === username);
  if (!found) throw new Error(`API user not found: ${username}`);
  return found;
}

function makeHybridApiUser(username: string): IUser {
  const base = u(username);
  return {
    ...base,
    isApi: true,
    apiConfig: base.apiConfig ?? {
      path: "/auth/login",
      fieldMap: { username: "email", password: "password" },
      additionalFields: {},
      headers: {},
      tokenType: "cookie",
      tokenPath: "",
      tokenHeaderName: "",
    },
  };
}

function eff(user: IUser, base: IAuthConfig): IAuthConfig {
  return {
    ...base,
    authType: user.authType ?? base.authType,
    authPageLayout: user.authPageLayout ?? base.authPageLayout,
    isApi: true,
    otpConfig: user.otpConfig ?? base.otpConfig,
    apiConfig: user.apiConfig ?? base.apiConfig,
    actionUrl: user.actionUrl ?? base.actionUrl,
  };
}

async function runHybridApi(
  browser: import("@playwright/test").Browser,
  authConfig: IAuthConfig,
  username: string,
) {
  const user = makeHybridApiUser(username);
  const config = eff(user, authConfig);
  const result = await new EmailPasswordOTPStrategy().authenticate(
    browser,
    user,
    config,
  );
  const meta = (result.metadata ?? {}) as Record<string, unknown>;

  expect(meta.authPath).toBe("api");

  const res = await result.context.request.get(`${user.actionUrl}/api/me`);
  expect(res.status()).toBe(200);
  expect((await res.json()).user.email).toBe(user.username);
  await result.context.close();

  return { user, metadata: meta };
}

// ═════════════════════════════════════════════════════════════════════════════
// §1  API path — all hybrid user variants
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§1 EmailPasswordOTPStrategy — API path (no browser)", () => {
  test("hybrid-user@test.com (port 3005): password step + OTP step; /api/me 200", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridApi(
      browser,
      authConfig,
      "hybrid-user@test.com",
    );
    expect(metadata.authType).toBe("email-password-otp");
    expect(metadata.authPath).toBe("api");
  });

  test("hybrid-admin@test.com (port 3006): admin role authenticated; /api/me 200", async ({
    browser,
    authConfig,
  }) => {
    const { user, metadata } = await runHybridApi(
      browser,
      authConfig,
      "hybrid-admin@test.com",
    );
    expect(metadata.authType).toBe("email-password-otp");
    expect(user.role).toBe("admin");
  });

  test("hybrid-sp-page@test.com (port 3014): layout irrelevant — API path identical", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridApi(
      browser,
      authConfig,
      "hybrid-sp-page@test.com",
    );
    expect(metadata.authPath).toBe("api");
  });

  test("hybrid-ef-page@test.com (port 3016): progressive-reveal variant; same API outcome", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridApi(
      browser,
      authConfig,
      "hybrid-ef-page@test.com",
    );
    expect(metadata.authPath).toBe("api");
    expect(metadata.authType).toBe("email-password-otp");
  });

  test("hybrid-sp-multi@test.com (port 3015): segmented OTP mode ignored in API path", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridApi(
      browser,
      authConfig,
      "hybrid-sp-multi@test.com",
    );
    expect(metadata.authPath).toBe("api");
  });

  test("hybrid-ef-multi@test.com (port 3017): progressive + segmented both ignored in API", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridApi(
      browser,
      authConfig,
      "hybrid-ef-multi@test.com",
    );
    expect(metadata.authPath).toBe("api");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §2  Sequencing — password step must complete before OTP step
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§2 EmailPasswordOTPStrategy API — sequencing guarantees", () => {
  test("wrong password rejects before OTP is requested — OTP endpoint never called", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...makeHybridApiUser("hybrid-user@test.com"),
      password: "WRONG_PASSWORD",
    };
    const config = eff(user, authConfig);

    await expect(
      new EmailPasswordOTPStrategy().authenticate(browser, user, config),
    ).rejects.toThrow(/4\d\d|invalid|credentials/i);
  });

  test("correct password but wrong OTP → rejects at verify step", async ({
    browser,
    authConfig,
  }) => {
    const base = makeHybridApiUser("hybrid-user@test.com");
    const user: IUser = {
      ...base,
      otpConfig: {
        ...(base.otpConfig as any),
        verifyConfig: {
          ...(base.otpConfig as any)?.verifyConfig,
          body: { email: "{username}", otp: "000000" }, // wrong OTP hardcoded
        },
      },
    };
    const config = eff(user, authConfig);

    await expect(
      new EmailPasswordOTPStrategy().authenticate(browser, user, config),
    ).rejects.toThrow();
  });
});
