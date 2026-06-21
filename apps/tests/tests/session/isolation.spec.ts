/**
 * isolation.spec.ts — Session isolation: independent contexts, logout cross-contamination (§12 + [TEST]9)
 */

import { test, expect } from "qa-pwmaf";
import { AuthFactory, IAuthConfig, IUser } from "qa-pwmaf";
import rawUsers from "../data/users.json";
import rawApiUsers from "../data/users.api.json";

const allUsers = rawUsers as IUser[];
const allApiUsers = rawApiUsers as IUser[];
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

function u(n: string, src: IUser[] = allUsers) {
  return (
    src.find((x) => x.username === n) ??
    (() => {
      throw new Error(n);
    })()
  );
}

test.describe("§12 Session isolation — browser users", () => {
  test("user@test.com and admin@test.com see their own /api/me identity", async ({
    getContext,
  }) => {
    const [a, b] = [u("user@test.com"), u("admin@test.com")];
    const [ctxA, ctxB] = await Promise.all([
      getContext(a.username),
      getContext(b.username),
    ]);
    const [dA, dB] = await Promise.all([
      ctxA.request.get(`${a.actionUrl}/api/me`).then((r) => r.json()),
      ctxB.request.get(`${b.actionUrl}/api/me`).then((r) => r.json()),
    ]);
    expect(dA.user.email).toBe(a.username);
    expect(dB.user.email).toBe(b.username);
    expect(dA.user.email).not.toBe(dB.user.email);
  });

  test("logging out userA does not invalidate userB's session", async ({
    browser,
    authConfig,
    getContext,
  }) => {
    const [a, b] = [u("user@test.com"), u("admin@test.com")];

    // Disposable session for "a" — this test deliberately logs it out, so it
    // must not be the same cookie the shared `.auth/user@test.com.json`
    // pool uses (that file is relied on by every other spec file).
    const strategy = factory.getStrategy(eff(a, authConfig));
    const { context: ctxA } = await strategy.authenticate(
      browser,
      a,
      eff(a, authConfig),
    );
    const ctxB = await getContext(b.username);

    expect((await ctxA.request.get(`${a.actionUrl}/api/me`)).status()).toBe(
      200,
    );
    expect((await ctxB.request.get(`${b.actionUrl}/api/me`)).status()).toBe(
      200,
    );
    await ctxA.request.post(`${a.actionUrl}/auth/logout`);
    expect((await ctxA.request.get(`${a.actionUrl}/api/me`)).status()).toBe(
      401,
    );
    const resB = await ctxB.request.get(`${b.actionUrl}/api/me`);
    expect(resB.status()).toBe(200);
    expect((await resB.json()).user.email).toBe(b.username);

    await ctxA.close();
  });

  test("OAuth user and email-password user sessions are isolated", async ({
    getContext,
  }) => {
    const [o, ep] = [u("google-user@gmail.com"), u("user@test.com")];
    const [ctxO, ctxEP] = await Promise.all([
      getContext(o.username),
      getContext(ep.username),
    ]);
    const [rO, rEP] = await Promise.all([
      ctxO.request.get(`${o.actionUrl}/api/me`).then((r) => r.json()),
      ctxEP.request.get(`${ep.actionUrl}/api/me`).then((r) => r.json()),
    ]);
    expect(rO.user.email).toBe(o.username);
    expect(rEP.user.email).toBe(ep.username);
  });

  test("OTP user and email-password user sessions are isolated", async ({
    getContext,
  }) => {
    const [o, ep] = [u("otp-user@test.com"), u("user@test.com")];
    const [ctxO, ctxEP] = await Promise.all([
      getContext(o.username),
      getContext(ep.username),
    ]);
    const [rO, rEP] = await Promise.all([
      ctxO.request.get(`${o.actionUrl}/api/me`).then((r) => r.json()),
      ctxEP.request.get(`${ep.actionUrl}/api/me`).then((r) => r.json()),
    ]);
    expect(rO.user.email).toBe(o.username);
    expect(rEP.user.email).toBe(ep.username);
  });

  test("unauthenticated context returns 401 from all ports", async ({
    browser,
  }) => {
    const ports = [3001, 3003, 3005, 3007, 3008, 3009, 3019, 3020];
    const bare = await browser.newContext();
    await Promise.all(
      ports.map(async (p) => {
        expect(
          (await bare.request.get(`http://localhost:${p}/api/me`)).status(),
        ).toBe(401);
      }),
    );
    await bare.close();
  });

  test("unauthenticated dashboard hides user-info element", async ({
    browser,
  }) => {
    const bare = await browser.newContext();
    const page = await bare.newPage();
    await page.goto("http://localhost:3001/dashboard.html");
    await expect(page.locator(".subtitle")).toContainText(/invalid|expired/i);
    await expect(page.locator("#user-info")).not.toBeVisible();
    await bare.close();
  });
});

test.describe("[TEST]9 Session isolation — API users", () => {
  test("email-password API users have independent sessions", async ({
    getContext,
  }) => {
    const [a, b] = [
      u("user@test.com", allApiUsers),
      u("admin@test.com", allApiUsers),
    ];
    const [ctxA, ctxB] = await Promise.all([
      getContext(a.username),
      getContext(b.username),
    ]);
    const [dA, dB] = await Promise.all([
      ctxA.request.get(`${a.actionUrl}/api/me`).then((r) => r.json()),
      ctxB.request.get(`${b.actionUrl}/api/me`).then((r) => r.json()),
    ]);
    expect(dA.user.email).toBe(a.username);
    expect(dB.user.email).toBe(b.username);
  });

  test("logging out cookie-user does not invalidate admin session (API)", async ({
    browser,
    authConfig,
    getContext,
  }) => {
    const [a, b] = [
      u("user@test.com", allApiUsers),
      u("admin@test.com", allApiUsers),
    ];

    const strategy = factory.getStrategy(eff(a, authConfig));
    const { context: ctxA } = await strategy.authenticate(
      browser,
      a,
      eff(a, authConfig),
    );
    const ctxB = await getContext(b.username);

    await ctxA.request.post(`${a.actionUrl}/auth/logout`);
    expect((await ctxA.request.get(`${a.actionUrl}/api/me`)).status()).toBe(
      401,
    );
    expect((await ctxB.request.get(`${b.actionUrl}/api/me`)).status()).toBe(
      200,
    );

    await ctxA.close();
  });

  test("bearer and cookie API sessions are isolated", async ({
    getContext,
  }) => {
    const [cookie, bearer] = [
      u("user@test.com", allApiUsers),
      u("bearer-user@test.com", allApiUsers),
    ];
    const [ctxC, ctxB] = await Promise.all([
      getContext(cookie.username),
      getContext(bearer.username),
    ]);
    const [rC, rB] = await Promise.all([
      ctxC.request.get(`${cookie.actionUrl}/api/me`).then((r) => r.json()),
      ctxB.request.get(`${bearer.actionUrl}/api/me`).then((r) => r.json()),
    ]);
    expect(rC.user.email).toBe(cookie.username);
    expect(rB.user.email).toBe(bearer.username);
  });

  test("unauthenticated bare context gets 401 from all API-user ports", async ({
    browser,
  }) => {
    const ports = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];
    const bare = await browser.newContext();
    await Promise.all(
      ports.map(async (p) => {
        expect(
          (await bare.request.get(`http://localhost:${p}/api/me`)).status(),
        ).toBe(401);
      }),
    );
    await bare.close();
  });
});
