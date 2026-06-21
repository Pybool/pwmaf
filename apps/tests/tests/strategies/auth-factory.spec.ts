/**
 * auth-factory.spec.ts — AuthFactory strategy resolution
 *
 * §1  Correct strategy class resolved per authType
 *     Verifies AuthFactory.getStrategy() returns the right class for every
 *     supported authType, respects customStrategy, and throws on unknown types.
 *
 * These are Jest unit tests — no browser or mock servers needed.
 */

import {
  AuthFactory,
  EmailPasswordStrategy,
  EmailOTPStrategy,
  EmailPasswordOTPStrategy,
  OAuthStrategy,
  OIDCStrategy,
  SAMLStrategy,
  IAuthStrategy,
} from "qa-pwmaf";

import { test, expect } from "qa-pwmaf";

const factory = new AuthFactory();

test.describe("§1 AuthFactory — strategy resolution", () => {
  test("resolves EmailPasswordStrategy for authType email-password", ({
    authConfig,
  }) => {
    const s = factory.getStrategy({
      ...authConfig,
      authType: "email-password",
    });
    expect(s).toBeInstanceOf(EmailPasswordStrategy);
  });

  test("resolves EmailOTPStrategy for authType email-otp", ({ authConfig }) => {
    const s = factory.getStrategy({ ...authConfig, authType: "email-otp" });
    expect(s).toBeInstanceOf(EmailOTPStrategy);
  });

  test("resolves EmailPasswordOTPStrategy for authType email-password-otp", ({
    authConfig,
  }) => {
    const s = factory.getStrategy({
      ...authConfig,
      authType: "email-password-otp",
    });
    expect(s).toBeInstanceOf(EmailPasswordOTPStrategy);
  });

  test("resolves OAuthStrategy for authType oauth", ({ authConfig }) => {
    const s = factory.getStrategy({ ...authConfig, authType: "oauth" });
    expect(s).toBeInstanceOf(OAuthStrategy);
  });

  test("resolves OIDCStrategy for authType oidc", ({ authConfig }) => {
    const s = factory.getStrategy({ ...authConfig, authType: "oidc" });
    expect(s).toBeInstanceOf(OIDCStrategy);
  });

  test("resolves SAMLStrategy for authType saml", ({ authConfig }) => {
    const s = factory.getStrategy({ ...authConfig, authType: "saml" });
    expect(s).toBeInstanceOf(SAMLStrategy);
  });

  test("returns customStrategy when set — ignores authType entirely", ({
    authConfig,
  }) => {
    const fakeStrategy: IAuthStrategy = {
      authenticate: async () => ({ context: null as any }),
    };
    const s = factory.getStrategy({
      ...authConfig,
      authType: "email-password",
      customStrategy: fakeStrategy,
    });
    expect(s).toBe(fakeStrategy);
  });

  test("customStrategy takes priority regardless of authType", ({
    authConfig,
  }) => {
    const fakeStrategy: IAuthStrategy = {
      authenticate: async () => ({ context: null as any }),
    };
    for (const authType of [
      "email-password",
      "email-otp",
      "oauth",
      "oidc",
      "saml",
    ] as const) {
      const s = factory.getStrategy({
        ...authConfig,
        authType,
        customStrategy: fakeStrategy,
      });
      expect(s).toBe(fakeStrategy);
    }
  });

  test("throws on unrecognised authType", ({ authConfig }) => {
    expect(() =>
      factory.getStrategy({ ...authConfig, authType: "magic-link" as any }),
    ).toThrow(/Unsupported auth type/i);
  });
});
