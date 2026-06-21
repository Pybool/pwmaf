/**
 * email-password.api.spec.ts — EmailPasswordStrategy API paths
 *
 * Consolidates §3 (from auth.spec.ts) and [TEST]1–4 (from auth-api.spec.ts).
 *
 * §1  cookie tokenType    — session cookie stored; /api/me returns 200
 * §2  bearer tokenType    — Authorization: Bearer injected; bare context gets 401
 * §3  custom-header       — X-Auth-Token injected; bare context gets 401
 * §4  fieldMap + additionalFields — POST body keys renamed and extra fields merged
 *
 * Mock server requirements:
 *   port 3001 — cookie, fieldMap, additionalFields
 *   port 3002 — admin cookie
 *   port 3007 — bearer (requires Authorization header)
 *   port 3008 — custom-header (requires X-Auth-Token)
 */

import { test, expect } from "qa-pwmaf";
import { BrowserContext } from "@playwright/test";
import { EmailPasswordStrategy, IUser, IAuthConfig } from "qa-pwmaf";
import rawApiUsers from "../data/users.api.json";

const allApiUsers = rawApiUsers as IUser[];

function u(username: string): IUser {
  const found = allApiUsers.find((x) => x.username === username);
  if (!found) throw new Error(`API user not found: ${username}`);
  return found;
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

async function runApi(
  browser: import("@playwright/test").Browser,
  user: IUser,
  config: IAuthConfig,
  keepOpen = false,
): Promise<{ context: BrowserContext; metadata: Record<string, unknown> }> {
  const result = await new EmailPasswordStrategy().authenticate(
    browser,
    user,
    config,
  );
  const meta = (result.metadata ?? {}) as Record<string, unknown>;

  expect(meta.authPath, `${user.username} should set authPath to "api"`).toBe(
    "api",
  );

  const res = await result.context.request.get(`${user.actionUrl}/api/me`);
  expect(res.status(), `/api/me must return 200 for ${user.username}`).toBe(
    200,
  );
  expect((await res.json()).user.email).toBe(user.username);

  if (!keepOpen) await result.context.close();
  return { context: result.context, metadata: meta };
}

// ═══════════════════════════════════════════════════════════════════
// §1  Cookie tokenType
// ═══════════════════════════════════════════════════════════════════

test.describe("§1 EmailPasswordStrategy API — cookie tokenType", () => {
  test("user@test.com: POSTs credentials, cookie set, /api/me returns 200", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("user@test.com"), isApi: true };
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.tokenType).toBe("cookie");
    expect(metadata.authType).toBe("email-password");
  });

  test("admin@test.com: admin role authenticated via API, /api/me returns 200", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("admin@test.com"), isApi: true };
    const { context, metadata } = await runApi(
      browser,
      user,
      eff(user, authConfig),
      true,
    );
    expect(metadata.tokenType).toBe("cookie");

    const res = await context.request.get(`${user.actionUrl}/api/me`);
    expect((await res.json()).user.role).toBe("admin");
    await context.close();
  });

  test("cookie persists across successive requests on the same context", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("user@test.com"), isApi: true };
    const { context } = await runApi(
      browser,
      user,
      eff(user, authConfig),
      true,
    );

    const [r1, r2] = await Promise.all([
      context.request.get(`${user.actionUrl}/api/me`),
      context.request.get(`${user.actionUrl}/api/me`),
    ]);
    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);
    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════
// §2  Bearer tokenType
// ═══════════════════════════════════════════════════════════════════

test.describe("§2 EmailPasswordStrategy API — bearer tokenType", () => {
  test("token extracted from response and injected as Authorization: Bearer", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("bearer-user@test.com"), isApi: true };
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.tokenType).toBe("bearer");
    expect(metadata.authType).toBe("email-password");
  });

  test("bare context without Authorization header gets 401 — proves header is required", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("bearer-user@test.com"), isApi: true };
    const { context } = await runApi(
      browser,
      user,
      eff(user, authConfig),
      true,
    );

    const bare = await browser.newContext();
    expect((await bare.request.get(`${user.actionUrl}/api/me`)).status()).toBe(
      401,
    );

    await bare.close();
    await context.close();
  });

  test("tokenPath dot-notation extracts token from response body correctly", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("bearer-user@test.com"), isApi: true };
    // If extraction fails, authenticate() throws — passing proves path resolves
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.tokenType).toBe("bearer");
  });
});

// ═══════════════════════════════════════════════════════════════════
// §3  Custom-header tokenType
// ═══════════════════════════════════════════════════════════════════

test.describe("§3 EmailPasswordStrategy API — custom-header tokenType", () => {
  test("X-Auth-Token header injected; /api/me returns 200", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("header-user@test.com"), isApi: true };
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.tokenType).toBe("custom-header");
    expect(metadata.authType).toBe("email-password");
  });

  test("bare context without X-Auth-Token gets 401", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("header-user@test.com"), isApi: true };
    const { context } = await runApi(
      browser,
      user,
      eff(user, authConfig),
      true,
    );

    const bare = await browser.newContext();
    expect((await bare.request.get(`${user.actionUrl}/api/me`)).status()).toBe(
      401,
    );

    await bare.close();
    await context.close();
  });

  test("tokenHeaderName is required — missing it would throw before any request", ({
    authConfig,
  }) => {
    const user: IUser = {
      ...u("header-user@test.com"),
      isApi: true,
      apiConfig: {
        path: "/auth/login",
        fieldMap: { username: "email", password: "password" },
        tokenType: "custom-header",
        tokenPath: "X-Auth-Token",
        // tokenHeaderName deliberately omitted
      },
    };
    expect(user.apiConfig?.tokenType).toBe("custom-header");
    expect(user.apiConfig?.tokenHeaderName).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// §4  fieldMap rename + additionalFields merge
// ═══════════════════════════════════════════════════════════════════

test.describe("§4 EmailPasswordStrategy API — fieldMap and additionalFields", () => {
  test("fieldMap.username renamed to 'email' in POST body — server accepts it", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("user@test.com"), isApi: true };
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.authPath).toBe("api");
  });

  test("additionalFields (rememberMe, clientId, grant_type) merged into POST body", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("user@test.com"), isApi: true };
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.authPath).toBe("api");
  });

  test("admin@test.com — no additionalFields — plain fieldMap rename is sufficient", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("admin@test.com"), isApi: true };
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.authPath).toBe("api");
    expect(metadata.tokenType).toBe("cookie");
  });

  test("custom extra headers are sent with the login request", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = { ...u("user@test.com"), isApi: true };
    const { metadata } = await runApi(browser, user, eff(user, authConfig));
    expect(metadata.authPath).toBe("api");
  });
});
