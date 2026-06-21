/**
 * expiry.spec.ts — Session expiry and stale file handling (§20)
 *
 * Verifies that the framework handles stale / expired sessions gracefully:
 *   - expired JWT cookie → /api/me returns 401 (server rejects it)
 *   - empty cookies array → /api/me returns 401
 *   - stale metadata.savedAt is detectable as old
 *   - re-authenticating after stale session produces a valid fresh session
 *
 * The framework is not expected to transparently refresh sessions — it must not
 * crash on stale files. Refresh/re-auth is the caller's responsibility.
 */

import fs from "fs";
import path from "path";
import { test, expect } from "qa-pwmaf";
import { EmailPasswordStrategy, IUser } from "qa-pwmaf";
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

const BASE = "http://localhost:3001";

function writeStaleSession(
  filename: string,
  overrides: Partial<{ cookies: any[]; origins: any[]; metadata: object }> = {},
) {
  const defaults = {
    cookies: [],
    origins: [],
    metadata: {
      username: "stale@test.com",
      authType: "email-password",
      savedAt: new Date(0).toISOString(),
    },
  };
  const p = path.join(".auth", filename);
  fs.mkdirSync(".auth", { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ ...defaults, ...overrides }));
  return p;
}

test.describe("§20 Session expiry — stale and invalid session files", () => {
  test("expired JWT cookie causes /api/me to return 401 — server rejects it", async ({
    browser,
  }) => {
    const stalePath = writeStaleSession("__expired__.json", {
      cookies: [
        {
          name: "auth_token",
          value:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InN0YWxlQHRlc3QuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjEsImV4cCI6MTAwfQ.invalid",
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
        },
      ],
    });
    const ctx = await browser.newContext({ storageState: stalePath });
    expect((await ctx.request.get(`${BASE}/api/me`)).status()).toBe(401);
    await ctx.close();
    fs.unlinkSync(stalePath);
  });

  test("empty session (no cookies) loads without error but yields 401", async ({
    browser,
  }) => {
    const emptyPath = writeStaleSession("__empty__.json");
    const ctx = await browser.newContext({ storageState: emptyPath });
    expect((await ctx.request.get(`${BASE}/api/me`)).status()).toBe(401);
    await ctx.close();
    fs.unlinkSync(emptyPath);
  });

  test("stale metadata.savedAt is detectable as older than 1 hour", () => {
    const stalePath = writeStaleSession("__old_meta__.json");
    const raw = JSON.parse(fs.readFileSync(stalePath, "utf-8"));
    expect(
      Date.now() - new Date(raw.metadata.savedAt).getTime(),
    ).toBeGreaterThan(3_600_000);
    fs.unlinkSync(stalePath);
  });

  test("re-authenticating after stale session produces a valid fresh session", async ({
    browser,
    authConfig,
  }) => {
    const user = u("user@test.com");
    const stalePath = writeStaleSession("__re_auth__.json");

    const staleCtx = await browser.newContext({ storageState: stalePath });
    expect(
      (await staleCtx.request.get(`${user.actionUrl}/api/me`)).status(),
    ).toBe(401);
    await staleCtx.close();

    const result = await new EmailPasswordStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const res = await result.context.request.get(`${user.actionUrl}/api/me`);
    expect(res.status()).toBe(200);
    expect((await res.json()).user.email).toBe(user.username);

    await result.context.close();
    if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath);
  });
});
