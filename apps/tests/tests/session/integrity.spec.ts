/**
 * integrity.spec.ts — Session integrity: /api/me + role assertions (§11 + [TEST]8)
 *
 * Uses pre-built sessions from global-setup (test.use storageState).
 * No re-authentication — pure session-validity coverage.
 *
 * Per user:
 *   - GET /api/me → 200, correct email and role
 *   - GET /api/config → 200 (public route)
 *   - GET /dashboard.html → user-info element visible with correct data
 *   - POST /auth/logout → clears session → /api/me returns 401
 */

import { test, expect } from "qa-pwmaf";
import { authFile, AuthFactory, IUser, IAuthConfig } from "qa-pwmaf";
import rawUsers from "../data/users.json";
import rawApiUsers from "../data/users.api.json";

const allUsers = rawUsers as IUser[];
const factory = new AuthFactory();

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
// ─────────────────────────────────────────────────────────────────────────────
// Browser users — §11
// ─────────────────────────────────────────────────────────────────────────────

test.describe("§11 Session integrity — browser users", () => {
  // These run BEFORE the per-user logout loop below, against the still-intact
  // shared session pool from global-setup. (Previously these ran *after* the
  // loop and always saw 401s, because the loop logs every user out of the
  // same shared `.auth/<user>.json` files that getContext() reads.)
  test("all admin users return role: admin from /api/me", async ({
    authConfig,
    getContext,
  }) => {
    const admins = authConfig.users.filter((u) => u.role === "admin");
    await Promise.all(
      admins.map(async (user) => {
        const ctx = await getContext(user.username);
        const res = await ctx.request.get(`${user.actionUrl}/api/me`);
        expect(res.status()).toBe(200);
        expect((await res.json()).user.role).toBe("admin");
      }),
    );
  });

  test("all regular users return role: user from /api/me", async ({
    authConfig,
    getContext,
  }) => {
    const regulars = authConfig.users.filter((u) => u.role === "user");
    await Promise.all(
      regulars.map(async (user) => {
        const ctx = await getContext(user.username);
        const res = await ctx.request.get(`${user.actionUrl}/api/me`);
        expect(res.status()).toBe(200);
        expect((await res.json()).user.role).toBe("user");
      }),
    );
  });

  for (const user of allUsers) {
    test.describe(`[${user.authType}] ${user.username}`, () => {
      test.use({ storageState: authFile(user.username) });

      test("GET /api/me returns 200 with correct email and role", async ({
        request,
      }) => {
        const res = await request.get(`${user.actionUrl}/api/me`);
        expect(res.status()).toBe(200);
        const { user: me } = await res.json();
        expect(me.email).toBe(user.username);
        expect(me.role).toBe(user.role);
      });

      test("dashboard page renders user-specific elements", async ({
        page,
      }) => {
        await page.goto(`${user.actionUrl}/dashboard.html`);
        await expect(page.locator("#user-info")).toBeVisible();
        await expect(page.locator("#user-email")).toContainText(user.username);
        await expect(page.locator("#user-role")).toContainText(
          user.role as string,
        );
      });

      test("GET /api/config is public — no auth required", async ({
        request,
      }) => {
        const res = await request.get(`${user.actionUrl}/api/config`);
        expect(res.status()).toBe(200);
        const config = await res.json();
        expect(config).toHaveProperty("authType");
        expect(config).toHaveProperty("authFlow");
        expect(config).toHaveProperty("tokenType");
      });

      test("POST /auth/logout clears session → subsequent /api/me returns 401", async ({
        browser,
        authConfig,
      }) => {
        test.skip(
          ["bearer-user@test.com", "header-user@test.com"].includes(
            user.username,
          ),
          "Token-based auth (bearer/custom-header) isn't cookie-session based — /auth/logout doesn't apply the same way.",
        );

        // Disposable session, minted fresh just for this assertion. The
        // shared `.auth/<user>.json` cookie is never touched here, so the
        // canonical session pool stays valid for every other spec file that
        // runs after this one in the same suite run.
        const strategy = factory.getStrategy(eff(user, authConfig));
        const { context } = await strategy.authenticate(
          browser,
          user,
          eff(user, authConfig),
        );

        expect(
          (await context.request.get(`${user.actionUrl}/api/me`)).status(),
        ).toBe(200);
        await context.request.post(`${user.actionUrl}/auth/logout`);
        expect(
          (await context.request.get(`${user.actionUrl}/api/me`)).status(),
        ).toBe(401);

        await context.close();
      });
    });
  }
});
