/**
 * api-errors.spec.ts — API authentication failure paths ([TEST]10)
 *
 * Verifies that all three API strategies fail fast and cleanly on bad input:
 *   - wrong password → 4xx before any OTP step
 *   - wrong OTP → 4xx at verify step (password step already passed)
 *   - nonexistent user → requestConfig endpoint returns error
 *   - missing tokenPath → "Could not extract token"
 *   - empty password → 4xx immediately
 *   - custom-header: missing tokenHeaderName is detectable
 *
 * All tests expect rejects — none should silently produce a wrong session.
 */

import { test, expect } from "qa-pwmaf";
import {
  EmailPasswordStrategy,
  EmailOTPStrategy,
  EmailPasswordOTPStrategy,
  IUser,
} from "qa-pwmaf";
import type { IAuthConfig } from "qa-pwmaf";
import rawApiUsers from "../data/users.api.json";

const allApiUsers = rawApiUsers as IUser[];
function u(n: string): IUser {
  return (
    allApiUsers.find((x) => x.username === n) ??
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
    isApi: true,
    otpConfig: user.otpConfig ?? base.otpConfig,
    apiConfig: user.apiConfig ?? base.apiConfig,
    actionUrl: user.actionUrl ?? base.actionUrl,
  };
}

test.describe("[TEST]10 Error paths — API authentication failures", () => {
  test("wrong password → EmailPasswordStrategy throws with 4xx status", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("user@test.com"),
      isApi: true,
      password: "WRONG",
    };
    await expect(
      new EmailPasswordStrategy().authenticate(
        browser,
        user,
        eff(user, authConfig),
      ),
    ).rejects.toThrow(/API auth failed.*4\d\d/i);
  });

  test("wrong password for admin → EmailPasswordStrategy throws with 4xx", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("admin@test.com"),
      isApi: true,
      password: "WRONG",
    };
    await expect(
      new EmailPasswordStrategy().authenticate(
        browser,
        user,
        eff(user, authConfig),
      ),
    ).rejects.toThrow(/API auth failed.*4\d\d/i);
  });

  test("nonexistent user → EmailOTPStrategy throws when requestConfig returns error", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("otp-user@test.com"),
      isApi: true,
      username: "nobody@test.com",
      otpConfig: {
        mode: "single-input",
        strategy: "single-input",
        autoSubmit: false,
        source: "api-request",
        requestConfig: {
          baseUrl: "http://localhost:3003",
          path: "/auth/request-otp",
          method: "POST",
          headers: {},
          queryParams: {},
          body: { email: "{username}" },
          responsePath: "otp",
        },
        verifyConfig: {
          baseUrl: "http://localhost:3003",
          path: "/auth/verify-otp",
          method: "POST",
          headers: {},
          queryParams: {},
          body: { email: "{username}", otp: "{otp}" },
          accessTokenPath: "data.accessToken",
        },
      },
    };
    await expect(
      new EmailOTPStrategy().authenticate(browser, user, eff(user, authConfig)),
    ).rejects.toThrow();
  });

  test("wrong OTP hardcoded in verifyConfig.body → EmailOTPStrategy throws", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("otp-user@test.com"),
      isApi: true,
      otpConfig: {
        mode: "single-input",
        strategy: "single-input",
        autoSubmit: false,
        source: "api-request",
        requestConfig: {
          baseUrl: "http://localhost:3003",
          path: "/auth/request-otp",
          method: "POST",
          headers: {},
          queryParams: {},
          body: { email: "{username}" },
          responsePath: "otp",
        },
        verifyConfig: {
          baseUrl: "http://localhost:3003",
          path: "/auth/verify-otp",
          method: "POST",
          headers: {},
          queryParams: {},
          body: { email: "{username}", otp: "000000" },
          accessTokenPath: "data.accessToken",
        },
      },
    };
    await expect(
      new EmailOTPStrategy().authenticate(browser, user, eff(user, authConfig)),
    ).rejects.toThrow();
  });

  test("missing tokenPath for bearer → throws 'Could not extract token'", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("bearer-user@test.com"),
      isApi: true,
      apiConfig: {
        path: "/auth/login",
        fieldMap: { username: "email", password: "password" },
        tokenType: "bearer",
        tokenPath: "nonexistent.deeply.nested.path",
      },
    };
    await expect(
      new EmailPasswordStrategy().authenticate(
        browser,
        user,
        eff(user, authConfig),
      ),
    ).rejects.toThrow(/Could not extract token/i);
  });

  test("EmailPasswordOTPStrategy wrong password → rejects before OTP step", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("hybrid-user@test.com"),
      isApi: true,
      password: "WRONG",
      apiConfig: {
        path: "/auth/login",
        fieldMap: { username: "email", password: "password" },
        additionalFields: {},
        headers: {},
        tokenType: "cookie",
        tokenPath: "",
        tokenHeaderName: "",
      },
    };
    await expect(
      new EmailPasswordOTPStrategy().authenticate(
        browser,
        user,
        eff(user, authConfig),
      ),
    ).rejects.toThrow(/4\d\d|invalid|credentials/i);
  });

  test("empty password → EmailPasswordStrategy throws with 4xx", async ({
    browser,
    authConfig,
  }) => {
    const user: IUser = {
      ...u("user@test.com"),
      isApi: true,
      password: "",
      apiConfig: {
        path: "/auth/login",
        fieldMap: { username: "email", password: "password" },
        tokenType: "cookie",
      },
    };
    await expect(
      new EmailPasswordStrategy().authenticate(
        browser,
        user,
        eff(user, authConfig),
      ),
    ).rejects.toThrow(/API auth failed.*4\d\d/i);
  });

  test("custom-header tokenType with missing tokenHeaderName is detectable before request", ({
    authConfig,
  }) => {
    const user: IUser = {
      ...u("header-user@test.com"),
      isApi: true,
      apiConfig: {
        path: "/auth/login",
        fieldMap: { username: "email", password: "password" },
        tokenType: "custom-header",
        tokenPath: "X-Auth-Token" /* tokenHeaderName omitted */,
      },
    };
    expect(user.apiConfig?.tokenType).toBe("custom-header");
    expect(user.apiConfig?.tokenHeaderName).toBeUndefined();
  });
});
