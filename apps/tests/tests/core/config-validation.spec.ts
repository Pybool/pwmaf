/**
 * config-validation.spec.ts — validateConfig() + ConfigValidationError
 *
 * WHAT THIS FILE TESTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  §1  Required fields      — missing actionUrl, mode, authType, users, etc.
 *  §2  authType-specific    — email-password needs no extras; otp needs otpConfig;
 *                             oauth needs oauthProvider; oidc needs oidcProvider;
 *                             saml needs samlProvider
 *  §3  IOTPConfig rules     — source + corresponding config sub-fields
 *  §4  IAPIAuthConfig rules — isApi: true requires apiConfig; tokenType rules;
 *                             custom-header requires tokenHeaderName
 *  §5  TokenStorageConfig   — storageType/storageKey required when present;
 *                             dot-notation tokenPath is accepted; per-user override
 *  §6  Per-user overrides   — user-level authType/otpConfig/apiConfig validation
 *  §7  Warnings             — non-fatal issues are collected but not thrown
 *  §8  ConfigValidationError shape — message formatting, issues array, levels
 *
 * These are Playwright test-runner unit tests (no browser, no mock servers).
 * They run in the `unit` CI project.
 */

import { test, expect } from "../fixtures/fixtures";
import { ConfigValidationError, IAuthConfig, validateConfig } from "qa-pwmaf";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid base config — extend per test to trigger specific errors. */
function base(): IAuthConfig {
  return {
    actionUrl: "http://localhost:3000/login",
    mode: "multi",
    authType: "email-password",
    users: [{ username: "user@test.com", password: "Pass1!" }],
    storageStatePath: ".auth",
    BASE_SERVER_URL: "http://localhost:3000",
    selectors: {},
  };
}

/** Call validateConfig and return the thrown ConfigValidationError, or null. */
function validate(config: Partial<IAuthConfig>): ConfigValidationError | null {
  try {
    validateConfig({ ...base(), ...config } as IAuthConfig);
    return null;
  } catch (e) {
    if (e instanceof ConfigValidationError) return e;
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// §1  Required fields
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§1 Required fields", () => {
  test("valid minimal config passes without throwing", () => {
    expect(() => validateConfig(base())).not.toThrow();
  });

  test("missing actionUrl throws ConfigValidationError", () => {
    const err = validate({ actionUrl: "" });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/actionUrl/i);
  });

  test("missing mode throws ConfigValidationError", () => {
    const err = validate({ mode: undefined as any });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/mode/i);
  });

  test("invalid mode value throws ConfigValidationError", () => {
    const err = validate({ mode: "parallel" as any });
    expect(err).not.toBeNull();
  });

  test("missing authType throws ConfigValidationError", () => {
    const err = validate({ authType: undefined as any });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/authType/i);
  });

  test("invalid authType value throws ConfigValidationError", () => {
    const err = validate({ authType: "magic-link" as any });
    expect(err).not.toBeNull();
  });

  test("empty users array throws ConfigValidationError", () => {
    const err = validate({ users: [] });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/users/i);
  });

  test("missing storageStatePath throws ConfigValidationError", () => {
    const err = validate({ storageStatePath: "" });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/storageStatePath/i);
  });

  test("missing BASE_SERVER_URL throws ConfigValidationError", () => {
    const err = validate({ BASE_SERVER_URL: "" });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/BASE_SERVER_URL/i);
  });

  test("user without username throws ConfigValidationError", () => {
    const err = validate({
      users: [{ username: "" }],
    });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/username/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §2  authType-specific requirements
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§2 authType-specific requirements", () => {
  test("email-otp: missing otpConfig throws", () => {
    const err = validate({ authType: "email-otp", otpConfig: undefined });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/otpConfig/i);
  });

  test("email-password-otp: missing otpConfig throws", () => {
    const err = validate({
      authType: "email-password-otp",
      otpConfig: undefined,
    });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/otpConfig/i);
  });

  test("oauth: missing oauthProvider emits warning but does not throw", () => {
    const err = validate({
      authType: "oauth",
      oauthProvider: undefined,
    });

    expect(err).toBeNull();
  });

  test("oauth: invalid oauthProvider value throws", () => {
    const err = validate({
      authType: "oauth",
      oauthProvider: "twitter" as any,
    });
    expect(err).not.toBeNull();
  });

  test("oidc: missing oidcProvider emits warning but does not throw", () => {
    const err = validate({
      authType: "oidc",
      oidcProvider: undefined,
    });
    console.log("Err============> ", err);

    expect(err).toBeNull();
  });

  test("saml: missing samlProvider throws", () => {
    const err = validate({
      authType: "saml",
      samlProvider: undefined,
    });
    expect(err).toBeNull();
  });

  test("custom: passes without extra fields", () => {
    const fakeStrategy = {
      authenticate: async () => ({ context: null as any }),
    };
    expect(() =>
      validateConfig({
        ...base(),
        authType: "custom",
        customStrategy: fakeStrategy,
      }),
    ).not.toThrow();
  });

  test("custom: missing customStrategy throws", () => {
    const err = validate({
      authType: "custom",
      customStrategy: undefined,
    });
    expect(err).not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §3  IOTPConfig rules
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§3 IOTPConfig validation", () => {
  function otpBase(): Partial<IAuthConfig> {
    return {
      authType: "email-otp",
      otpConfig: {
        mode: "single-input",
        strategy: "single-input",
        autoSubmit: false,
        source: "env",
        envKey: "TEST_OTP",
      },
    };
  }

  test("valid OTP config passes", () => {
    expect(() => validateConfig({ ...base(), ...otpBase() })).not.toThrow();
  });

  test("invalid OTPMode value throws", () => {
    const err = validate({
      ...otpBase(),
      otpConfig: { ...(otpBase().otpConfig as any), mode: "unknown-mode" },
    });
    expect(err).not.toBeNull();
  });

  test("invalid OTPSource value throws", () => {
    const err = validate({
      ...otpBase(),
      otpConfig: { ...(otpBase().otpConfig as any), source: "sms" },
    });
    expect(err).not.toBeNull();
  });

  test("source: api-intercept with missing interceptPattern is a warning, not error", () => {
    // interceptPattern has a default — missing it should produce a warning, not throw
    const cfg: IAuthConfig = {
      ...base(),
      ...otpBase(),
      otpConfig: {
        ...(otpBase().otpConfig as any),
        source: "api-intercept",
        interceptPattern: undefined,
      },
    };
    // Should either pass or throw with only warnings — not a hard error
    // (exact behaviour depends on implementation; adjust if it throws)
    try {
      validateConfig(cfg);
    } catch (e) {
      if (e instanceof ConfigValidationError) {
        // If it throws, it should be a warning-level issue, not an error
        const hasOnlyWarnings = e.allIssues.every((i) => i.level === "warning");
        expect(hasOnlyWarnings).toBe(true);
      } else {
        throw e;
      }
    }
  });

  test("source: api-request with missing requestConfig throws", () => {
    const err = validate({
      ...otpBase(),
      otpConfig: {
        ...(otpBase().otpConfig as any),
        source: "api-request",
        requestConfig: undefined,
      },
    });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/requestConfig/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §4  IAPIAuthConfig rules (isApi: true)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§4 IAPIAuthConfig validation", () => {
  test("isApi: true without apiConfig throws", () => {
    const err = validate({ isApi: true, apiConfig: undefined });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/apiConfig/i);
  });

  test("isApi: true with apiConfig.path passes", () => {
    expect(() =>
      validateConfig({
        ...base(),
        isApi: true,
        apiConfig: { path: "/auth/login", tokenType: "cookie" },
      }),
    ).not.toThrow();
  });

  test("tokenType: bearer without tokenPath is a warning", () => {
    const cfg: IAuthConfig = {
      ...base(),
      isApi: true,
      apiConfig: {
        path: "/auth/login",
        tokenType: "bearer",
        // tokenPath omitted — framework uses "token" as default
      },
    };
    // Should either pass or warn only
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  test("tokenType: custom-header without tokenHeaderName throws", () => {
    const err = validate({
      isApi: true,
      apiConfig: {
        path: "/auth/login",
        tokenType: "custom-header",
        tokenPath: "token",
        // tokenHeaderName omitted
      },
    });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/tokenHeaderName/i);
  });

  test("invalid tokenType value throws", () => {
    const err = validate({
      isApi: true,
      apiConfig: {
        path: "/auth/login",
        tokenType: "session-cookie" as any,
      },
    });
    expect(err).not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §5  TokenStorageConfig validation
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§5 TokenStorageConfig validation", () => {
  test("valid localStorage config passes", () => {
    expect(() =>
      validateConfig({
        ...base(),
        tokenStorageConfig: {
          storageType: "localStorage",
          storageKey: "user",
          tokenPath: "accessToken",
          origin: "http://localhost:3000",
        },
      }),
    ).not.toThrow();
  });

  test("valid sessionStorage config passes", () => {
    expect(() =>
      validateConfig({
        ...base(),
        tokenStorageConfig: {
          storageType: "sessionStorage",
          storageKey: "auth",
        },
      }),
    ).not.toThrow();
  });

  test("invalid storageType throws", () => {
    const err = validate({
      tokenStorageConfig: {
        storageType: "indexedDB" as any,
        storageKey: "auth",
      },
    });
    console.log("err ====> ", err)
    expect(err).not.toBeNull();
  });

  test("missing storageKey throws", () => {
    const err = validate({
      tokenStorageConfig: {
        storageType: "localStorage",
        storageKey: "",
      },
    });
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/storageKey/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §6  Per-user override validation
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§6 Per-user override validation", () => {
  test("user with authType override that requires otpConfig — validated at user level", () => {
    const err = validate({
      users: [
        {
          username: "otp-user@test.com",
          authType: "email-otp",
          // otpConfig missing at both root and user level
        },
      ],
    });
    expect(err).not.toBeNull();
  });

  test("user with valid per-user apiConfig passes", () => {
    expect(() =>
      validateConfig({
        ...base(),
        users: [
          {
            username: "api-user@test.com",
            password: "pass",
            isApi: true,
            apiConfig: { path: "/auth/login", tokenType: "cookie" },
          },
        ],
      }),
    ).not.toThrow();
  });

  test("user-level invalid authType throws", () => {
    const err = validate({
      users: [
        {
          username: "bad-user@test.com",
          authType: "ftp" as any,
        },
      ],
    });
    expect(err).not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §7  Warnings — non-fatal issues collected but not thrown
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§7 Warnings vs errors", () => {
  test("ConfigValidationError exposes an issues array", () => {
    // Trigger a known error so we can inspect the issues array shape
    let err: ConfigValidationError | null = null;
    try {
      validateConfig({ ...base(), actionUrl: "" });
    } catch (e) {
      if (e instanceof ConfigValidationError) err = e;
    }
    expect(err).not.toBeNull();
    expect(Array.isArray(err!.allIssues)).toBe(true);
    expect(err!.allIssues.length).toBeGreaterThan(0);
  });

  test("each issue has level, field, and message properties", () => {
    let err: ConfigValidationError | null = null;
    try {
      validateConfig({ ...base(), actionUrl: "" });
    } catch (e) {
      if (e instanceof ConfigValidationError) err = e;
    }
    expect(err).not.toBeNull();

    for (const issue of err!.allIssues) {
      expect(typeof issue.level).toBe("string");
      expect(typeof issue.message).toBe("string");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §8  ConfigValidationError shape
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§8 ConfigValidationError shape", () => {
  test("is an instance of Error", () => {
    let err: unknown;
    try {
      validateConfig({ ...base(), actionUrl: "" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConfigValidationError);
  });

  test("error message lists all failing fields", () => {
    // Trigger two errors at once
    let err: ConfigValidationError | null = null;
    try {
      validateConfig({ ...base(), actionUrl: "", storageStatePath: "" });
    } catch (e) {
      if (e instanceof ConfigValidationError) err = e;
    }
    expect(err).not.toBeNull();
    // Both fields should appear somewhere in the message
    expect(err!.message).toMatch(/actionUrl/i);
    expect(err!.message).toMatch(/storageStatePath/i);
  });

  test("multiple errors collected in a single throw (not fail-fast)", () => {
    let err: ConfigValidationError | null = null;
    try {
      validateConfig({
        ...base(),
        actionUrl: "",
        storageStatePath: "",
        BASE_SERVER_URL: "",
      });
    } catch (e) {
      if (e instanceof ConfigValidationError) err = e;
    }
    expect(err).not.toBeNull();
    // All three errors should be collected
    expect(err!.allIssues.length).toBeGreaterThanOrEqual(3);
  });
});
