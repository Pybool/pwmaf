/**
 * auth-manager.spec.ts — AuthManager lifecycle and configuration behaviour
 *
 * §13 getContext fixture  — session loading, unknown-user fallback, navigation
 * §15 mode: single        — cached vs multi (fresh per call)
 * §16 deleteAuthStorageOnTestRun — pre-existing file cleared / preserved
 * §17 rateLimited         — sequential delay vs parallel timing
 * §22 Context lifecycle   — no leaked handles in multi mode (BUG 9 regression)
 */

import fs from "fs";
import path from "path";
import { test, expect } from "qa-pwmaf";
import { AuthManager } from "qa-pwmaf";
import { IAuthConfig, IUser } from "qa-pwmaf";
import rawUsers from "../data/users.json";

/**
 * §16/§17/§22 below construct throwaway AuthManager instances purely to
 * exercise setup()/teardown()/rateLimited/deleteAuthStorageOnTestRun
 * behaviour. teardown() calls logoutSession() -> factory.deleteSession(),
 * which fs.unlinkSync()'s `${storageStatePath}/${username}.json`.
 *
 * If these throwaway managers inherit the real `authConfig.storageStatePath`
 * (".auth"), teardown() deletes the SAME .auth/user@test.com.json and
 * .auth/admin@test.com.json files that global-setup.ts wrote once for the
 * whole suite and that every other spec file depends on. Since global setup
 * only runs once per full run, those files never come back — breaking
 * persistence.spec.ts, integrity.spec.ts and isolation.spec.ts later in the
 * run, even though this file's own assertions all still pass.
 *
 * Routing these throwaway managers to an isolated scratch directory keeps
 * their setup()/teardown() cycles from ever touching the shared session pool.
 */
const SCRATCH_DIR = ".auth-scratch";

test.afterAll(() => {
  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
});

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

// ─────────────────────────────────────────────────────────────────────────────
// §13  getContext fixture
// ─────────────────────────────────────────────────────────────────────────────

test.describe("§13 getContext fixture behaviour", () => {
  test("returns authenticated context for known user — /api/me 200", async ({
    getContext,
  }) => {
    const user = u("user@test.com");
    const ctx = await getContext(user.username);
    const res = await ctx.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);
  });

  test("returns unauthenticated context for unknown username — /api/me 401", async ({
    getContext,
  }) => {
    const ctx = await getContext("__nobody__@test.com");
    expect(
      (await ctx.request.get("http://localhost:3001/api/me")).status(),
    ).toBe(401);
  });

  test("multiple calls return independent contexts (different cookie jars)", async ({
    getContext,
  }) => {
    const [a, b] = [u("user@test.com"), u("admin@test.com")];
    const [ctxA, ctxB] = await Promise.all([
      getContext(a.username),
      getContext(b.username),
    ]);
    expect(ctxA).not.toBe(ctxB);
    const [dA, dB] = await Promise.all([
      ctxA.request.get(`${a.actionUrl}/api/me`).then((r) => r.json()),
      ctxB.request.get(`${b.actionUrl}/api/me`).then((r) => r.json()),
    ]);
    expect(dA.user.email).toBe(a.username);
    expect(dB.user.email).toBe(b.username);
  });

  test("context from getContext() supports page.goto navigation", async ({
    getContext,
  }) => {
    const user = u("user@test.com");
    const ctx = await getContext(user.username);
    const page = await ctx.newPage();
    await page.goto(`${user.actionUrl}/dashboard.html`);
    await expect(page.locator("#user-email")).toContainText(user.username);
    await page.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §15  mode: single vs multi
// ─────────────────────────────────────────────────────────────────────────────

test.describe("§15 mode: single vs multi", () => {
  test("multi mode: same username called twice returns different context instances", async ({
    browser,
    authManager,
  }) => {
    const ctx1 = await authManager.getContext("user@test.com", browser);
    const ctx2 = await authManager.getContext("user@test.com", browser);
    expect(ctx1).not.toBe(ctx2);
    expect(ctx1).not.toBeNull();
    expect(ctx2).not.toBeNull();
    await ctx1.close();
    await ctx2.close();
  });

  test("single mode: cached context has valid session — /api/me 200", async ({
    getContext,
  }) => {
    const user = u("user@test.com");
    const ctx = await getContext(user.username);
    const res = await ctx.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);
  });

  test("multi mode: each fresh context has valid session — /api/me 200", async ({
    browser,
    authManager,
  }) => {
    const user = u("user@test.com");
    const ctx = await authManager.getContext(user.username, browser);
    const res = await ctx.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);
    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §16  deleteAuthStorageOnTestRun
// ─────────────────────────────────────────────────────────────────────────────

test.describe("§16 deleteAuthStorageOnTestRun", () => {
  const STALE_USER = "user@test.com";
  const STALE_CONTENT = JSON.stringify({
    cookies: [],
    origins: [],
    metadata: {
      username: STALE_USER,
      authType: "email-password",
      savedAt: "2000-01-01T00:00:00.000Z",
    },
  });

  test("true: removes stale session file content before setup, writes fresh", async ({
    browser,
    authConfig,
  }) => {
    const stalePath = path.join(SCRATCH_DIR, `${STALE_USER}.json`);
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    fs.writeFileSync(stalePath, STALE_CONTENT);

    const manager = new AuthManager({
      ...authConfig,
      storageStatePath: SCRATCH_DIR,
      deleteAuthStorageOnTestRun: true,
      users: [u(STALE_USER)],
    });
    await manager.setup(browser);

    const written = JSON.parse(fs.readFileSync(stalePath, "utf-8"));
    expect(
      Date.now() - new Date(written.metadata.savedAt).getTime(),
    ).toBeLessThan(60_000);

    await manager.teardown();
  });

  test("false: existing session file is preserved (not deleted before setup)", async ({
    browser,
    authConfig,
  }) => {
    const stalePath = path.join(SCRATCH_DIR, `${STALE_USER}.json`);
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    fs.writeFileSync(stalePath, STALE_CONTENT);

    const manager = new AuthManager({
      ...authConfig,
      storageStatePath: SCRATCH_DIR,
      deleteAuthStorageOnTestRun: false,
      users: [u(STALE_USER)],
    });
    await manager.setup(browser);

    expect(fs.existsSync(stalePath)).toBe(true);
    await manager.teardown();
  });

  test("after setup(), fresh session files exist for all configured users", async ({
    browser,
    authConfig,
  }) => {
    const users = [u("user@test.com"), u("admin@test.com")];
    const config: IAuthConfig = {
      ...authConfig,
      storageStatePath: SCRATCH_DIR,
      deleteAuthStorageOnTestRun: true,
      users,
    };

    users.forEach((usr) => {
      const p = path.join(SCRATCH_DIR, `${usr.username}.json`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    const manager = new AuthManager(config);
    await manager.setup(browser);

    for (const usr of users) {
      expect(
        fs.existsSync(path.join(SCRATCH_DIR, `${usr.username}.json`)),
        `Missing: ${usr.username}`,
      ).toBe(true);
    }
    await manager.teardown();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §17  rateLimited
// ─────────────────────────────────────────────────────────────────────────────

test.describe("§17 rateLimited — login sequencing", () => {
  test("true: setup takes ≥ 500ms × (users-1) due to enforced delay", async ({
    browser,
    authConfig,
  }) => {
    const users = [u("user@test.com"), u("admin@test.com")];
    const manager = new AuthManager({
      ...authConfig,
      storageStatePath: SCRATCH_DIR,
      rateLimited: true,
      users,
    });
    const start = Date.now();
    await manager.setup(browser);
    expect(Date.now() - start).toBeGreaterThanOrEqual(450);
    await manager.teardown();
  });

  test("false: all users authenticate successfully in parallel", async ({
    browser,
    authConfig,
  }) => {
    const users = [u("user@test.com"), u("admin@test.com")];
    const manager = new AuthManager({
      ...authConfig,
      storageStatePath: SCRATCH_DIR,
      rateLimited: false,
      users,
    });
    await manager.setup(browser);
    for (const usr of users) {
      const ctx = await manager.getContext(usr.username, browser);
      expect(ctx).toBeTruthy();
      const res = await ctx.request.get(`${usr.actionUrl}/api/me`);
      expect(res.status()).toBe(200);
    }
    await manager.teardown();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §22  Context lifecycle — no leaked handles in multi mode (BUG 9 regression)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("§22 Context lifecycle — no leaked handles in multi mode", () => {
  test("browser.contexts().length does not increase after setup() saves session files", async ({
    browser,
    authConfig,
  }) => {
    const users = [u("user@test.com"), u("admin@test.com")];
    const manager = new AuthManager({
      ...authConfig,
      storageStatePath: SCRATCH_DIR,
      rateLimited: false,
      users,
    });
    const before = browser.contexts().length;
    await manager.setup(browser);
    expect(browser.contexts().length).toBe(before);
    await manager.teardown();
  });

  test("teardown() completes without error even when contexts were closed by setup()", async ({
    browser,
    authConfig,
  }) => {
    const manager = new AuthManager({
      ...authConfig,
      storageStatePath: SCRATCH_DIR,
      users: [u("user@test.com")],
    });
    await manager.setup(browser);
    await expect(manager.teardown()).resolves.not.toThrow();
  });
});
