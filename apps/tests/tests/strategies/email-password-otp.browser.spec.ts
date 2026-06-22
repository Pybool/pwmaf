/**
 * email-password-otp.browser.spec.ts — EmailPasswordOTPStrategy browser flows
 *
 * §6  All layout × OTP-mode combinations (browser)
 *
 * USERS (users.json):
 *   hybrid-user@test.com      single-page       × single-input  port 3005
 *   hybrid-admin@test.com     progressive-reveal × single-input  port 3006
 *   hybrid-sp-page@test.com   single-page       × single-input  port 3014
 *   hybrid-ef-page@test.com   progressive-reveal × single-input  port 3016
 *   hybrid-sp-multi@test.com  single-page       × segmented     port 3015
 *   hybrid-ef-multi@test.com  progressive-reveal × segmented     port 3017
 *
 * HOW CORRECTNESS IS VERIFIED
 * ─────────────────────────────────────────────────────────────────────────────
 *  strategy fills password (+ email on single-page) → submits → handles OTP.
 *  Each server rejects the wrong layout/OTP-mode sequence → /api/me 401 → fail.
 *  A passing /api/me 200 proves the correct end-to-end flow executed.
 */

import { test, expect } from "qa-pwmaf";
import { EmailPasswordOTPStrategy, IUser } from "qa-pwmaf";
import type { IAuthConfig } from "qa-pwmaf";
import rawUsers from "../data/users.browser.json";

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

async function runHybridBrowser(
  browser: import("@playwright/test").Browser,
  authConfig: IAuthConfig,
  username: string,
) {
  const user = u(username);
  const config = eff(user, authConfig);
  const result = await new EmailPasswordOTPStrategy().authenticate(
    browser,
    user,
    config,
  );
  const meta = (result.metadata ?? {}) as Record<string, unknown>;

  const res = await result.context.request.get(`${user.actionUrl}/api/me`);
  expect(res.status()).toBe(200);
  expect((await res.json()).user.email).toBe(user.username);
  await result.context.close();

  return { user, metadata: meta };
}

test.describe("§6 EmailPasswordOTPStrategy — browser (layout × OTP mode matrix)", () => {
  test("single-page × single-input: email + password together, OTP inline", async ({
    browser,
    authConfig,
  }) => {
    const { user, metadata } = await runHybridBrowser(
      browser,
      authConfig,
      "hybrid-user@test.com",
    );
    expect(metadata.authType).toBe("email-password-otp");
    expect(metadata.authPath).toBe("browser");
    expect(metadata.authPageLayout).toBe("single-page");
    expect(metadata.otpMode).toBe("single-input");
    expect(metadata.otpSource).toBe("api-request");
    expect(metadata.username).toBe(user.username);
  });

  test("progressive-reveal × single-input: email first, password reveals, OTP inline", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridBrowser(
      browser,
      authConfig,
      "hybrid-admin@test.com",
    );
    expect(metadata.authPageLayout).toBe("progressive-reveal");
    expect(metadata.otpMode).toBe("single-input");
    expect(metadata.otpSource).toBe("api-request");
  });

  test("single-page × single-input [alt port 3014]: OTP on same page after password submit", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridBrowser(
      browser,
      authConfig,
      "hybrid-sp-page@test.com",
    );
    expect(metadata.authType).toBe("email-password-otp");
    expect(metadata.authPageLayout).toBe("single-page");
    expect(metadata.otpMode).toBe("single-input");
  });

  test("progressive-reveal × single-input [alt port 3016]: two-step password, then OTP", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridBrowser(
      browser,
      authConfig,
      "hybrid-ef-page@test.com",
    );
    expect(metadata.authPageLayout).toBe("progressive-reveal");
    expect(metadata.otpMode).toBe("single-input");
  });

  test("single-page × segmented: email + password together, OTP across 6 inputs", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridBrowser(
      browser,
      authConfig,
      "hybrid-sp-multi@test.com",
    );
    expect(metadata.authPageLayout).toBe("single-page");
    expect(metadata.otpMode).toBe("segmented");
    expect(metadata.otpSource).toBe("api-request");
  });

  test("progressive-reveal × segmented: two-step password entry, then 6 digit inputs", async ({
    browser,
    authConfig,
  }) => {
    const { metadata } = await runHybridBrowser(
      browser,
      authConfig,
      "hybrid-ef-multi@test.com",
    );
    expect(metadata.authPageLayout).toBe("progressive-reveal");
    expect(metadata.otpMode).toBe("segmented");
    expect(metadata.otpSource).toBe("api-request");
  });
});
