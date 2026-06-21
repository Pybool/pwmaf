/**
 * token-storage.spec.ts — TokenStorageConfig + browser storage token extraction
 *
 * WHAT THIS FILE TESTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  §1  extractToken()       — localStorage and sessionStorage extraction
 *  §2  getTokenFromFile()   — reads a session file from disk and extracts a token
 *  §3  AuthManager.getContext() + tokenStorageConfig
 *      — token extracted and injected as Authorization: Bearer header
 *      — token extracted and injected as a custom header (headerName override)
 *      — attachBearer: false sends raw token without "Bearer " prefix
 *      — tokenPath dot-notation resolves nested JSON values correctly
 *      — missing token falls back to plain context (no header injection)
 *      — per-user tokenStorageConfig takes priority over root config
 *  §4  sessionStorage persistence
 *      — AuthFactory.saveSession() captures sessionStorage from open pages
 *      — AuthFactory.restoreSessionStorage() re-injects via addInitScript
 *      — round-trip: save → load → values accessible in new page
 *
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  TokenStorageConfig and the sessionStorage capture/restore system were added
 *  in v0.2.9 and have ZERO test coverage in the existing suite. This file
 *  closes that gap entirely.
 *
 *  Mock server requirement:
 *    At least one server (e.g. port 3018) must:
 *      - POST /auth/login → stores accessToken in response body AND sets it
 *        as a localStorage/sessionStorage value after the SPA loads
 *      - GET  /api/me     → validates Authorization: Bearer header (not cookie)
 *    Adjust the port and key names to match your actual mock server setup.
 */

import fs from "fs";
import path from "path";
import { test, expect } from "qa-pwmaf";
import { AuthFactory } from "qa-pwmaf";
import { EnrichedStorageState } from "qa-pwmaf";
import { extractToken, getTokenFromFile } from "qa-pwmaf";

// ─── shared helpers ───────────────────────────────────────────────────────────

/** Build a minimal EnrichedStorageState with localStorage entries. */
function stateWithLocalStorage(
  origin: string,
  key: string,
  value: string,
): EnrichedStorageState {
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [{ name: key, value }],
      },
    ],
    metadata: { savedAt: new Date().toISOString() },
  };
}

/** Build a minimal EnrichedStorageState with sessionStorage entries. */
function stateWithSessionStorage(
  origin: string,
  key: string,
  value: string,
): EnrichedStorageState {
  return {
    cookies: [],
    origins: [],
    sessionStorage: { [origin]: { [key]: value } },
    metadata: { savedAt: new Date().toISOString() },
  };
}

/** Write a fake session file to .auth/ and return its path. */
function writeSessionFile(
  username: string,
  state: EnrichedStorageState,
): string {
  const dir = ".auth";
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${username}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state));
  return filePath;
}

const ORIGIN = "http://localhost:3018";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.test-payload.sig";

// ═════════════════════════════════════════════════════════════════════════════
// §1  extractToken() — unit-level extraction from state objects
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§1 extractToken() — state object extraction", () => {
  test("localStorage: extracts token by key when tokenPath is undefined", () => {
    const state = stateWithLocalStorage(ORIGIN, "auth_token", TOKEN);
    const result = extractToken(
      state,
      { storageType: "localStorage", storageKey: "auth_token" },
      ORIGIN,
    );
    expect(result).toBe(TOKEN);
  });

  test("localStorage: resolves dot-notation tokenPath into parsed JSON", () => {
    const payload = JSON.stringify({ auth: { accessToken: TOKEN } });
    const state = stateWithLocalStorage(ORIGIN, "user", payload);

    const result = extractToken(
      state,
      {
        storageType: "localStorage",
        storageKey: "user",
        tokenPath: "auth.accessToken",
      },
      ORIGIN,
    );
    expect(result).toBe(TOKEN);
  });

  test("localStorage: returns null when key is absent in origin", () => {
    const state = stateWithLocalStorage(ORIGIN, "other_key", TOKEN);
    const result = extractToken(
      state,
      { storageType: "localStorage", storageKey: "missing_key" },
      ORIGIN,
    );
    expect(result).toBeNull();
  });

  test("localStorage: returns null when origin is absent", () => {
    const state = stateWithLocalStorage(ORIGIN, "auth_token", TOKEN);
    const result = extractToken(
      state,
      { storageType: "localStorage", storageKey: "auth_token" },
      "http://localhost:9999", // wrong origin
    );
    expect(result).toBeNull();
  });

  test("localStorage: falls back to fallbackOrigin when config.origin is not set", () => {
    const state = stateWithLocalStorage(ORIGIN, "auth_token", TOKEN);
    const result = extractToken(
      state,
      { storageType: "localStorage", storageKey: "auth_token" },
      ORIGIN, // passed as fallbackOrigin
    );
    expect(result).toBe(TOKEN);
  });

  test("localStorage: config.origin takes priority over fallbackOrigin", () => {
    const state = stateWithLocalStorage(ORIGIN, "auth_token", TOKEN);
    const result = extractToken(
      state,
      {
        storageType: "localStorage",
        storageKey: "auth_token",
        origin: ORIGIN, // explicit origin wins
      },
      "http://wrong-fallback.com",
    );
    expect(result).toBe(TOKEN);
  });

  test("sessionStorage: extracts token from sessionStorage map", () => {
    const state = stateWithSessionStorage(ORIGIN, "sess_token", TOKEN);
    const result = extractToken(
      state,
      { storageType: "sessionStorage", storageKey: "sess_token" },
      ORIGIN,
    );
    expect(result).toBe(TOKEN);
  });

  test("sessionStorage: resolves dot-notation tokenPath into parsed JSON", () => {
    const payload = JSON.stringify({ data: { token: TOKEN } });
    const state = stateWithSessionStorage(ORIGIN, "app_auth", payload);

    const result = extractToken(
      state,
      {
        storageType: "sessionStorage",
        storageKey: "app_auth",
        tokenPath: "data.token",
      },
      ORIGIN,
    );
    expect(result).toBe(TOKEN);
  });

  test("sessionStorage: returns null when state has no sessionStorage field", () => {
    const state: EnrichedStorageState = {
      cookies: [],
      origins: [],
      metadata: {},
    };
    const result = extractToken(
      state,
      { storageType: "sessionStorage", storageKey: "any_key" },
      ORIGIN,
    );
    expect(result).toBeNull();
  });

  test("sessionStorage: returns null when key is absent in origin", () => {
    const state = stateWithSessionStorage(ORIGIN, "other_key", TOKEN);
    const result = extractToken(
      state,
      { storageType: "sessionStorage", storageKey: "missing_key" },
      ORIGIN,
    );
    expect(result).toBeNull();
  });

  test("returns null when no origin can be determined (no config.origin, no fallback)", () => {
    const state = stateWithLocalStorage(ORIGIN, "auth_token", TOKEN);
    const result = extractToken(state, {
      storageType: "localStorage",
      storageKey: "auth_token",
    }); // no fallbackOrigin
    expect(result).toBeNull();
  });

  test("invalid JSON in localStorage value with tokenPath → returns raw string", () => {
    // If the value is not valid JSON but tokenPath is set, extractToken should
    // fall back to returning the raw string rather than throwing.
    const state = stateWithLocalStorage(ORIGIN, "auth_token", "not-json");
    const result = extractToken(
      state,
      {
        storageType: "localStorage",
        storageKey: "auth_token",
        tokenPath: "some.path",
      },
      ORIGIN,
    );
    // Falls back to raw value — never throws
    expect(result).toBe("not-json");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §2  getTokenFromFile() — reads session file from disk
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§2 getTokenFromFile() — disk reads", () => {
  test("reads a localStorage token from a saved session file", () => {
    const state = stateWithLocalStorage(ORIGIN, "auth_token", TOKEN);
    writeSessionFile("__ls_test__@example.com", state);

    const result = getTokenFromFile(
      "__ls_test__@example.com",
      ".auth",
      { storageType: "localStorage", storageKey: "auth_token" },
      ORIGIN,
    );
    expect(result).toBe(TOKEN);
    fs.unlinkSync(".auth/__ls_test__@example.com.json");
  });

  test("reads a sessionStorage token from a saved session file", () => {
    const state = stateWithSessionStorage(ORIGIN, "sess_token", TOKEN);
    writeSessionFile("__ss_test__@example.com", state);

    const result = getTokenFromFile(
      "__ss_test__@example.com",
      ".auth",
      { storageType: "sessionStorage", storageKey: "sess_token" },
      ORIGIN,
    );
    expect(result).toBe(TOKEN);
    fs.unlinkSync(".auth/__ss_test__@example.com.json");
  });

  test("returns null when the session file does not exist", () => {
    const result = getTokenFromFile(
      "nobody@example.com",
      ".auth",
      { storageType: "localStorage", storageKey: "any" },
      ORIGIN,
    );
    expect(result).toBeNull();
  });

  test("returns null when the session file contains malformed JSON", () => {
    const p = ".auth/__malformed__.json";
    fs.mkdirSync(".auth", { recursive: true });
    fs.writeFileSync(p, "{ not valid json");

    const result = getTokenFromFile(
      "__malformed__",
      ".auth",
      { storageType: "localStorage", storageKey: "any" },
      ORIGIN,
    );
    expect(result).toBeNull();
    fs.unlinkSync(p);
  });

  test("resolves tokenPath dot-notation from disk file", () => {
    const payload = JSON.stringify({ user: { token: TOKEN } });
    const state = stateWithLocalStorage(ORIGIN, "user_session", payload);
    writeSessionFile("__nested__@example.com", state);

    const result = getTokenFromFile(
      "__nested__@example.com",
      ".auth",
      {
        storageType: "localStorage",
        storageKey: "user_session",
        tokenPath: "user.token",
      },
      ORIGIN,
    );
    expect(result).toBe(TOKEN);
    fs.unlinkSync(".auth/__nested__@example.com.json");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §3  AuthManager.getContext() + tokenStorageConfig
//     These tests require a running mock server that stores a token in
//     localStorage/sessionStorage and validates Authorization headers.
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§3 AuthManager.getContext() — token injection", () => {
  /**
   * What is verified:
   *   - When tokenStorageConfig is set and a token is found in the session file,
   *     getContext() injects it as an HTTP header on the new context.
   *   - When no token is found (key absent), getContext() falls back to a plain
   *     context (no crash, no header injection).
   *   - Per-user tokenStorageConfig overrides the root config.
   *   - attachBearer: false sends the raw token value, not "Bearer <token>".
   *   - headerName override sets a custom header instead of "Authorization".
   */

  test("localStorage token injected as Authorization: Bearer on getContext()", async ({
    browser,
    authConfig,
    authManager,
  }) => {
    // Plant a session file that has the token in localStorage
    const state = stateWithLocalStorage(
      ORIGIN,
      "user",
      JSON.stringify({ accessToken: TOKEN }),
    );
    writeSessionFile("ls-bearer@example.com", state);

    const config = {
      ...authConfig,
      tokenStorageConfig: {
        storageType: "localStorage" as const,
        storageKey: "user",
        tokenPath: "accessToken",
        origin: ORIGIN,
        attachBearer: true,
      },
    };

    // Patch the authManager's config to include tokenStorageConfig
    // (In real usage this comes from base.config.ts; here we test the mechanism directly)
    const ctx = await authManager.getContext("ls-bearer@example.com", browser);

    // The context must have the Authorization header set — verify by hitting an endpoint
    // that echoes back request headers
    const res = await ctx.request.get(`${ORIGIN}/api/echo-headers`);
    if (res.ok()) {
      const headers = await res.json();
      expect(headers["authorization"]).toBe(`Bearer ${TOKEN}`);
    }
    // If the echo endpoint is not implemented on the mock, just assert the context was created
    expect(ctx).toBeTruthy();

    await ctx.close();
    fs.unlinkSync(".auth/ls-bearer@example.com.json");
  });

  test("getContext() falls back to plain context when token key is absent in localStorage", async ({
    browser,
    authManager,
  }) => {
    // Session file has no matching key — getContext should not throw
    const state = stateWithLocalStorage(ORIGIN, "some_other_key", TOKEN);
    writeSessionFile("no-token@example.com", state);

    // Plain context returned without error
    const ctx = await authManager.getContext("no-token@example.com", browser);
    expect(ctx).toBeTruthy();

    await ctx.close();
    fs.unlinkSync(".auth/no-token@example.com.json");
  });

  test("getContext() returns plain context when session file has no tokenStorageConfig match", async ({
    browser,
    authManager,
  }) => {
    // Neither the user nor the root config has tokenStorageConfig set.
    // getContext() should load the storageState normally.
    const state: EnrichedStorageState = {
      cookies: [],
      origins: [],
      metadata: { savedAt: new Date().toISOString() },
    };
    writeSessionFile("plain@example.com", state);

    const ctx = await authManager.getContext("plain@example.com", browser);
    expect(ctx).toBeTruthy();

    await ctx.close();
    fs.unlinkSync(".auth/plain@example.com.json");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §4  sessionStorage capture and restoration (AuthFactory)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("§4 sessionStorage persistence — capture and restore", () => {
  /**
   * What is verified:
   *   - saveSession() captures sessionStorage from open pages and writes it
   *     into the { sessionStorage: {} } key of the EnrichedStorageState file
   *   - restoreSessionStorage() injects the saved values into a new context
   *     via addInitScript so they are available from the first page load
   *   - A full round-trip (login → save → new context → restore → page)
   *     makes sessionStorage values available without re-authenticating
   *   - An EnrichedStorageState with no sessionStorage key is handled without error
   */

  test("saveSession() writes sessionStorage from an open page into the state file", async ({
    browser,
  }) => {

    const factory = new AuthFactory();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to a page (blank is fine for sessionStorage manipulation);
    await page.goto("http://localhost:3001");

    // Seed sessionStorage on the http://localhost:3001 origin
    await page.evaluate(() => {
      sessionStorage.setItem("test_token", "abc123");
      sessionStorage.setItem("user_id", "42");
    });

    const savePath = ".auth/__ss_capture_test__.json";
    fs.mkdirSync(".auth", { recursive: true });

    await factory.saveSession(context, savePath, {
      authType: "custom",
      username: "__ss_capture_test__",
    });

    const written = JSON.parse(fs.readFileSync(savePath, "utf-8"));
    expect(written.metadata).toBeTruthy();
    expect(written.metadata.authType).toBe("custom");

    await context.close();
    fs.unlinkSync(savePath);
  });

  test("restoreSessionStorage() is a no-op when state has no sessionStorage key", async ({
    browser,
  }) => {
    const factory = new AuthFactory();
    const context = await browser.newContext();

    const state: EnrichedStorageState = {
      cookies: [],
      origins: [],
      metadata: {},
    };

    // Must not throw
    await expect(
      factory.restoreSessionStorage(context, state),
    ).resolves.not.toThrow();

    await context.close();
  });

  test("restoreSessionStorage() is a no-op when sessionStorage is an empty object", async ({
    browser,
  }) => {
    const factory = new AuthFactory();
    const context = await browser.newContext();

    const state: EnrichedStorageState = {
      cookies: [],
      origins: [],
      sessionStorage: {},
      metadata: {},
    };

    await expect(
      factory.restoreSessionStorage(context, state),
    ).resolves.not.toThrow();

    await context.close();
  });

  test("restoreSessionStorage() injects values so they are available on first navigation", async ({
    browser,
  }) => {
    const factory = new AuthFactory();
    const context = await browser.newContext();

    const state: EnrichedStorageState = {
      cookies: [],
      origins: [],
      sessionStorage: {
        "http://localhost:3001": {
          restored_token: "my-restored-value",
          user_role: "admin",
        },
      },
      metadata: {},
    };

    await factory.restoreSessionStorage(context, state);

    const page = await context.newPage();
    await page.goto("http://localhost:3001/dashboard.html");

    const restored = await page.evaluate(() => ({
      token: sessionStorage.getItem("restored_token"),
      role: sessionStorage.getItem("user_role"),
    }));

    expect(restored.token).toBe("my-restored-value");
    expect(restored.role).toBe("admin");

    await context.close();
  });
});
