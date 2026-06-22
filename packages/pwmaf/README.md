# qa-pwmaf — Playwright Multi Auth Framework

> **Config-based session management for email/password, OTP, OAuth, OIDC, and SAML authentication flows in Playwright test suites.**

[![npm version](https://img.shields.io/npm/v/qa-pwmaf)](https://www.npmjs.com/package/qa-pwmaf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Playwright ^1.60](https://img.shields.io/badge/playwright-%5E1.60-blue)](https://playwright.dev)

---

## Table of Contents

1. [What is qa-pwmaf?](#what-is-qa-pwmaf)
2. [Requirements](#requirements)
3. [Installation](#installation)
4. [Quick Start](#quick-start)
5. [CLI Tool — `pwmaf init`](#cli-tool--pwmaf-init)
   - [Interactive Mode](#interactive-mode)
   - [Preset Mode](#preset-mode)
   - [List Available Presets](#list-available-presets)
   - [Dry Run Mode](#dry-run-mode)
6. [Manual Configuration — `base.config.ts`](#manual-configuration--baseconfigts)
   - [Config File Discovery](#config-file-discovery)
   - [Full Config Reference — `IAuthConfig`](#full-config-reference--iauthconfig)
   - [User Reference — `IUser`](#user-reference--iuser)
   - [Selector Overrides — `AuthOverrideSelectors`](#selector-overrides--authoverrideselectors)
   - [OTP Configuration — `IOTPConfig`](#otp-configuration--iotpconfig)
   - [OIDC Configuration — `IOIDCConfig`](#oidc-configuration--ioidcconfig)
   - [API Auth Configuration — `IAPIAuthConfig`](#api-auth-configuration--iapiauthconfig)
   - [Token Storage Configuration — `TokenStorageConfig`](#token-storage-configuration--tokenstorageconfig)
7. [Environment Variables](#environment-variables)
8. [Users File — `users.json`](#users-file--usersjson)
9. [Auth Strategies](#auth-strategies)
   - [Email/Password (Browser)](#emailpassword-browser)
   - [Email/Password (API)](#emailpassword-api)
   - [Email OTP](#email-otp)
   - [Email/Password + OTP](#emailpassword--otp)
   - [OAuth 2.0](#oauth-20)
   - [OIDC](#oidc)
   - [SAML](#saml)
   - [Custom Strategy](#custom-strategy)
10. [Integrating with Playwright — Global Setup](#integrating-with-playwright--global-setup)
11. [Using Sessions in Tests](#using-sessions-in-tests)
12. [Playwright Test Fixtures](#playwright-test-fixtures)
13. [Per-User Auth Overrides](#per-user-auth-overrides)
14. [Session Lifecycle — Events & Reporter](#session-lifecycle--events--reporter)
15. [API Reference](#api-reference)
16. [Type Reference](#type-reference)
17. [What qa-pwmaf Covers](#what-qa-pwmaf-covers)
18. [What Is Not Yet Supported](#what-is-not-yet-supported)
19. [Contributing](#contributing)
20. [AI Usage Policy](#ai-usage-policy)
21. [License](#license)

---

## What is qa-pwmaf?

`qa-pwmaf` solves the single most tedious problem in Playwright E2E test automation: **authentication setup**. Instead of copy-pasting login helpers across your test suite, maintaining bespoke `globalSetup` files for every auth flow, or dealing with fragile session caches, this framework gives you:

- **One config file** (`base.config.ts`) that describes how your application authenticates users.
- **One CLI command** (`npx pwmaf init`) that generates that config for you interactively.
- **Zero boilerplate** inside individual test files — sessions are loaded automatically via Playwright's `storageState`.
- **Six authentication strategies** out of the box: email/password, email OTP, email+password+OTP, OAuth 2.0, OIDC, and SAML — each supporting both browser-driven and API-level login flows where applicable.
- **Multi-user / multi-role support** so your test suite can switch between `admin`, `user`, `guest` and any other role without re-authenticating mid-run.
- **Automatic session expiry detection** and re-authentication when a stored session has gone stale.
- **Typed, validated configuration** with readable error messages that tell you exactly what field is wrong before your setup even starts.

---

## Requirements

| Dependency | Version |
|---|---|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 9.0.0 |
| `@playwright/test` | ^1.60.0 (peer dependency — you must install this yourself) |
| `ts-node` | ^10.9.2 (peer dependency — required when using a TypeScript config) |

Both peer dependencies must be installed in your project:

```bash
npm install -D @playwright/test ts-node
```

---

## Installation

```bash
# npm
npm install --save-dev qa-pwmaf

# yarn
yarn add -D qa-pwmaf

# pnpm
pnpm add -D qa-pwmaf
```

Install the required peer dependencies if you have not already:

```bash
npm install -D @playwright/test ts-node
```

---

## Quick Start

The fastest path to a working auth setup is three steps:

**Step 1 — Run the CLI to generate your config:**

```bash
npx pwmaf init
```

Follow the interactive prompts. The CLI writes `base.config.ts` and `src/data/users.json` to your project root.

**Step 2 — Add your real credentials to `src/data/users.json`:**

```json
[
  { "username": "admin@example.com", "password": "AdminPass1!" },
  { "username": "user@example.com", "password": "UserPass1!" }
]
```

**Step 3 — Wire up Playwright's `globalSetup`:**

```typescript
// global-setup.ts
import { chromium } from "@playwright/test";
import { getOrCreateAuthManager } from "qa-pwmaf";

export default async function globalSetup() {
  const browser = await chromium.launch();
  const manager = await getOrCreateAuthManager();
  await manager.setup(browser);
  await browser.close();
}
```

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./global-setup.ts",
  use: {
    storageState: ".auth/user@example.com.json", // default user session
  },
});
```

Your tests now run with authenticated sessions pre-loaded.

---

## CLI Tool — `pwmaf init`

The `pwmaf` CLI is the recommended way to bootstrap your config. It asks targeted questions about your authentication flow and writes correctly structured TypeScript files to disk.

### Interactive Mode

```bash
npx pwmaf init
```

This launches a guided prompt sequence covering:

- Which authentication type your application uses
- Whether login happens through the browser UI or a direct API call
- The login page URL and success redirect URL
- Whether you have multiple roles/users
- OTP delivery and resolution method (if applicable)
- OAuth/OIDC/SAML provider (if applicable)

At the end, the CLI writes two files:

- `base.config.ts` — the main framework config file at your project root
- `src/data/users.json` — a sample users file ready for your real credentials

### Preset Mode

If you already know your auth pattern, skip the prompts entirely:

```bash
npx pwmaf init --preset browser-email-password
```

All available presets and what they produce:

| Preset name | Auth type | Mode | Token |
|---|---|---|---|
| `browser-email-password` | email-password | Browser | Cookie |
| `browser-email-password-users-file` | email-password | Browser | Cookie (multi-role) |
| `browser-email-otp` | email-otp | Browser | Cookie |
| `browser-email-password-otp` | email-password-otp | Browser | Cookie |
| `browser-oauth-google` | oauth | Browser (mock) | Cookie |
| `browser-oidc-okta` | oidc | Browser (mock) | Cookie |
| `browser-saml-okta` | saml | Browser (mock) | Cookie |
| `api-email-password-cookie` | email-password | API | Cookie |
| `api-email-password-bearer` | email-password | API | Bearer token |
| `api-email-password-custom-header` | email-password | API | Custom header |
| `api-email-password-otp-bearer` | email-password-otp | API | Bearer token |
| `multi-role-email-password` | email-password | Browser | Cookie (multi-role) |
| `multi-role-mixed-auth` | email-password | Browser | Cookie (mixed per-user auth) |

### List Available Presets

```bash
npx pwmaf init --list-presets
```

Prints the full preset table with their `authType`, `isApi`, and config style values to stdout.

### Dry Run Mode

Preview the generated config without writing any files:

```bash
npx pwmaf init --preset browser-email-password --dry-run
npx pwmaf init --dry-run   # works with interactive mode too
```

The generated `base.config.ts` and `users.json` content is printed to the console so you can inspect it before committing.

---

## Manual Configuration — `base.config.ts`

You can write or edit `base.config.ts` by hand rather than using the CLI. This section documents every field so you know exactly what to put where.

### Config File Discovery

The framework searches upward from `process.cwd()` for a `package.json` to locate your project root, then looks for:

1. `<project-root>/base.config.ts` — tried first
2. `<project-root>/base.config.js` — tried if the `.ts` file is not found

If neither is found, startup fails with a clear error pointing to the expected path.

The config file must export your config object as either:

```typescript
export const BASE_CONFIG = { ... };   // named export
// OR
export default { ... };               // default export
```

### Full Config Reference — `IAuthConfig`

Below is a complete annotated example covering every supported field:

```typescript
// base.config.ts
import type { IAuthConfig } from "qa-pwmaf";

export const BASE_CONFIG: IAuthConfig = {

  // ─── REQUIRED ────────────────────────────────────────────────────────────

  /**
   * The URL of your application's login page.
   * When isApi: true, this should be the API origin (e.g. "http://localhost:3000")
   * and the endpoint path goes in apiConfig.path.
   */
  actionUrl: "http://localhost:3000/login",

  /**
   * "single"  — authenticate one user (the first in the users array).
   * "multi"   — authenticate all users in the array concurrently (or
   *             sequentially if rateLimited: true).
   */
  mode: "multi",

  /**
   * The authentication strategy to use.
   * One of: "email-password" | "email-otp" | "email-password-otp"
   *         | "oauth" | "oidc" | "saml" | "custom"
   */
  authType: "email-password",

  /**
   * Flat list of users to authenticate during global setup.
   * Usually populated from users.json via createAuthConfig().
   * Can also be hardcoded here, though users.json is recommended
   * to keep credentials out of source-controlled config files.
   */
  users: [],

  /**
   * Directory where per-user session files are saved.
   * Each user gets a file named "<username>.json" inside this directory.
   * Example: ".auth/admin@example.com.json"
   */
  storageStatePath: ".auth",

  /**
   * Base URL of your application backend.
   * Used by OAuth and OIDC strategies to construct the mock callback URL.
   * Example: "http://localhost:3000"
   */
  BASE_SERVER_URL: "http://localhost:3000",

  /**
   * Selector overrides for your application's auth page elements.
   * The framework ships with sensible defaults; only override what differs.
   * See AuthOverrideSelectors below for all available keys.
   */
  selectors: {},

  // ─── OPTIONAL ────────────────────────────────────────────────────────────

  /**
   * The URL (or glob pattern) the framework waits for after a successful login.
   * Defaults to "*\/\/*\/dashboard**" if not provided.
   * Supports Playwright URL glob syntax, e.g. "**/home**" or "https://app.example.com/dashboard"
   */
  successUrl: "**/dashboard**",

  /**
   * The visual layout of your login page. Drives how the strategy fills fields.
   *
   * "single-page"        — email and password fields are both visible at once.
   * "progressive-reveal" — you enter the email first, submit, then the password
   *                        field appears (common in Google-style flows).
   * "redirect-to-new-page" — email is submitted and the browser redirects to a
   *                          separate page for the next step (e.g. OTP page).
   */
  authPageLayout: "single-page",

  /**
   * OTP configuration. Required when authType is "email-otp"
   * or "email-password-otp". See IOTPConfig below.
   */
  otpConfig: undefined,

  /**
   * OAuth provider. Required when authType is "oauth".
   * One of: "google" | "github" | "microsoft" | "facebook"
   */
  oauthProvider: "google",

  /**
   * OIDC provider. Required when authType is "oidc".
   * One of: "okta" | "auth0" | "azure-ad" | "keycloak" | "cognito" | "ping"
   * Can also be configured via the structured oidcConfig field below.
   */
  oidcProvider: undefined,

  /**
   * Structured OIDC configuration. Takes priority over the flat oidcProvider field.
   * Use this when you need to specify additional OIDC parameters beyond just the provider name.
   * See IOIDCConfig below.
   */
  oidcConfig: undefined,

  /**
   * SAML provider. Required when authType is "saml".
   * One of: "okta" | "azure" | "onelogin" | "ping" | "adfs"
   */
  samlProvider: undefined,

  /**
   * If true, users are authenticated one at a time with a 500ms gap between each.
   * Use this when your application enforces concurrent login rate limits.
   * Defaults to false (parallel authentication).
   */
  rateLimited: false,

  /**
   * Maximum number of retry attempts if authentication fails.
   * On each retry, the framework waits 1 second before the next attempt.
   * Defaults to 2.
   */
  maxAuthRetries: 2,

  /**
   * If true, the framework calls your login API directly instead of
   * driving the browser UI. Faster and more reliable for most CI runs.
   * Requires apiConfig to also be configured.
   */
  isApi: false,

  /**
   * API-level authentication configuration. See IAPIAuthConfig below.
   * Required when isApi: true.
   */
  apiConfig: undefined,

  /**
   * Bring your own strategy. When set, this strategy is used instead of
   * any built-in one, regardless of the authType value.
   * Must implement the IAuthStrategy interface.
   */
  customStrategy: undefined,

  /**
   * If true, the session files in storageStatePath are deleted before
   * global setup runs, forcing a fresh login for every test run.
   * Defaults to false (sessions are reused across runs when still valid).
   */
  deleteAuthStorageOnTestRun: false,

  /**
   * If true, the framework will re-authenticate a user automatically
   * when their session is detected as expired at runtime.
   * Defaults to false.
   */
  allowReauth: true,

  /**
   * The name of the auth cookie to inspect when checking token expiry.
   * One of: "session" | "jwt" | "access_token"
   * Defaults to "auth_token" inside the expiry helper if not set.
   */
  tokenCookieName: "session",

  /**
   * Custom URL intercept patterns per OAuth provider.
   * Only needed if your OAuth provider's authorize endpoint does not match
   * the built-in patterns. Keys must be valid OAuthProvider values.
   */
  OAUTHProviderPatterns: undefined,

  /**
   * Custom URL intercept patterns per OIDC provider.
   * Only needed if your OIDC provider's authorize endpoint does not match
   * the built-in patterns. Keys must be valid OIDCProvider values.
   */
  OIDCProviderPatterns: undefined,

  /**
   * Set to true to enable step-by-step strategy logging during authentication.
   * Each step is printed to stdout with a timestamp offset from login start.
   * Useful for debugging auth failures. Keep false in production CI runs.
   */
  strategyLoggerActive: false,

  /**
   * Token storage configuration for apps that persist auth tokens in
   * localStorage or sessionStorage rather than (or in addition to) cookies.
   * When set, getContext() extracts the token from the saved session file and
   * injects it as an HTTP header on every new context it creates.
   * Can be overridden per-user via IUser.tokenStorageConfig.
   */
  tokenStorageConfig: undefined,

  /**
   * Legacy field for Google OAuth callback URL.
   * Prefer BASE_SERVER_URL for new configurations.
   */
  google_oauth_callback: undefined,
};
```

---

### User Reference — `IUser`

Each entry in your `users.json` (or hardcoded in `users: []`) follows this shape:

```typescript
interface IUser {
  /**
   * The user's email address or username. Used as:
   * - The value filled into the email field during browser login.
   * - The filename for the saved session: "<username>.json".
   * REQUIRED.
   */
  username: string;

  /**
   * The user's password. Required for "email-password" and
   * "email-password-otp" strategies. Omit for OTP-only flows.
   */
  password?: string;

  /**
   * The user's role in your application. Informational only — the framework
   * does not make any decisions based on this value, but it is available
   * to your test helpers for role-based test branching.
   * One of: "admin" | "user" | "guest"
   */
  role?: "admin" | "user" | "guest";

  /**
   * Per-user override of the root authType.
   * Use this when different users in the same test suite need to log in
   * through different mechanisms — for example, an admin who uses SAML
   * SSO while regular users use email/password.
   */
  authType?: AuthType;

  /**
   * Per-user OAuth provider override.
   */
  oauthProvider?: OAuthProvider;

  /**
   * Per-user OIDC provider override (flat form).
   */
  oidcProvider?: OIDCProvider;

  /**
   * Per-user structured OIDC configuration. Takes priority over oidcProvider.
   * Use when this user needs a different mockServerUrl, redirectUri, or other
   * OIDC parameters from the root-level config.
   */
  oidcConfig?: IOIDCConfig;

  /**
   * Per-user SAML provider override.
   */
  samlProvider?: SAMLProvider;

  /**
   * Per-user override of the login page layout.
   */
  authPageLayout?: AuthPageLayout;

  /**
   * Per-user API auth flag override.
   * Set to true to make this specific user authenticate via API
   * even if the root config has isApi: false.
   */
  isApi?: boolean;

  /**
   * Per-user OTP config override.
   * Useful when different users receive OTPs through different channels
   * (e.g. one user gets OTP via email API, another has a static env OTP).
   */
  otpConfig?: IOTPConfig;

  /**
   * Per-user API config override.
   * Takes priority over the root-level apiConfig when set.
   */
  apiConfig?: IAPIAuthConfig;

  /**
   * Per-user token storage config override.
   * Takes priority over the root-level tokenStorageConfig when set.
   * Use when different users store their token under different localStorage or
   * sessionStorage keys, or in different origins.
   */
  tokenStorageConfig?: TokenStorageConfig;

  /**
   * Per-user login URL override.
   * Use when different users must log in through different endpoints —
   * for example, a multi-tenant app where each organisation has its own
   * login URL.
   */
  actionUrl?: string;
}
```

---

### Selector Overrides — `AuthOverrideSelectors`

By default the framework targets the following selectors on your login page. Override only what differs from your application's actual DOM:

```typescript
interface AuthOverrideSelectors {
  /**
   * Input field where the email or username is typed.
   * Default: "[data-testid='email']"
   */
  emailOrUsernameField?: string;

  /**
   * Input field where the password is typed.
   * Default: "[data-testid='password']"
   */
  passwordField?: string;

  /**
   * Hidden OTP input — typically a browser-managed field with
   * autocomplete="one-time-code". Used by the "hidden-input" OTP strategy.
   * Default: "input[autocomplete='one-time-code']"
   */
  otpHiddenField?: string;

  /**
   * Single OTP input (e.g. a full 6-digit field).
   * Default: "[data-testid='otp']"
   */
  otpSingleField?: string;

  /**
   * Selector that matches ALL segmented OTP digit boxes.
   * The framework calls .nth(i) on this locator for each digit.
   * Default: "[data-testid='otp-field']"
   */
  otpMultiFields?: string;

  /**
   * Submit button clicked after entering the email.
   * Default: "button[type='submit']"
   */
  emailSubmitButton?: string;

  /**
   * Submit button clicked after entering the password.
   * Default: "button[type='submit']"
   */
  passwordSubmitButton?: string;

  /**
   * Submit button clicked after entering the OTP.
   * Default: "button[id='submit-btn']"
   */
  otpSubmitButton?: string;

  /**
   * "Continue with Google" button on your login page.
   * Default: "button:has-text('Continue with Google')"
   */
  googleOAuthButton?: string;

  /**
   * "Continue with Microsoft" button on your login page.
   * Default: "button:has-text('Continue with Microsoft')"
   */
  microsoftOAuthButton?: string;

  /**
   * "Continue with Github" button on your login page.
   * Default: "button:has-text('Continue with Github')"
   */
  githubOAuthButton?: string;

  /**
   * "Continue with LinkedIn" button on your login page.
   * Default: "button:has-text('Continue with LinkedIn')"
   */
  linkedInOAuthButton?: string;

  /**
   * "Continue with Facebook" button on your login page.
   * Default: "button:has-text('Continue with Facebook')"
   */
  facebookOAuthButton?: string;

  /**
   * SSO / Enterprise login button used by OIDC flows.
   * Default: "#sso-btn"
   */
  ssoButton?: string;
}
```

**Example — overriding selectors for a non-standard login page:**

```typescript
// base.config.ts
export const BASE_CONFIG: IAuthConfig = {
  // ...
  selectors: {
    emailOrUsernameField: "input[name='loginEmail']",
    passwordField:        "input[name='loginPassword']",
    emailSubmitButton:    "#submit-login",
    passwordSubmitButton: "#submit-login",
  },
};
```

---

### OTP Configuration — `IOTPConfig`

Required when `authType` is `"email-otp"` or `"email-password-otp"`.

```typescript
interface IOTPConfig {
  /**
   * The visual format of the OTP input on screen.
   *
   * "single-input"  — one text field that accepts the full OTP string.
   * "segmented"     — multiple single-digit boxes (e.g. six boxes for a 6-digit code).
   *                   Requires fieldCount to be set.
   */
  mode: "single-input" | "segmented";

  /**
   * The DOM interaction strategy the framework uses to fill the OTP field.
   *
   * "single-input"  — fills a standard visible text input with the full OTP string.
   * "hidden-input"  — types the OTP character-by-character into a browser-managed
   *                   hidden input (autocomplete="one-time-code").
   * "multi-input"   — fills each digit box individually. Used when mode is "segmented".
   */
  strategy: "single-input" | "hidden-input" | "multi-input";

  /**
   * Number of digit boxes in a segmented OTP field.
   * Only read when strategy is "multi-input". Defaults to 6.
   */
  fieldCount?: number;

  /**
   * Whether the form auto-submits after the last OTP digit is entered.
   */
  autoSubmit: boolean;

  /**
   * How the framework obtains the OTP value:
   *
   * "env"            — read from an environment variable.
   * "api-intercept"  — intercept the network response from the OTP send endpoint.
   * "api-request"    — proactively call an API to trigger/retrieve the OTP.
   */
  source: "env" | "api-intercept" | "api-request";

  /**
   * The URL (or glob) of the OTP entry page. Only read when authPageLayout
   * is "redirect-to-new-page". Example: "**/verify-otp**"
   */
  otpPageUrl?: string;

  /**
   * When source is "env": the name of the environment variable that holds
   * the OTP value. Defaults to "TEST_OTP" if not provided.
   */
  envKey?: string;

  /**
   * When source is "api-intercept": the URL pattern to intercept.
   * Defaults to "**/api/send-otp**"
   */
  interceptPattern?: string;

  /**
   * When source is "api-request": config for the HTTP call that triggers
   * or retrieves the OTP.
   */
  requestConfig?: IOTPRequestConfig;

  /**
   * When source is "api-request" and the OTP is verified via a separate
   * endpoint: config for the verification call.
   */
  verifyConfig?: IOTPVerificationConfig;
}

interface IOTPRequestConfig {
  /** Base URL of the OTP request endpoint. E.g. "http://localhost:3000" */
  baseUrl: string;

  /**
   * Path of the OTP endpoint. Supports {username} and {userId} placeholders.
   * Example: "/api/otp/send/{username}"
   */
  path: string;

  /** HTTP method. Defaults to "GET". */
  method?: "GET" | "POST";

  headers?: Record<string, string>;

  /**
   * Query parameters. Values support {username} and {userId} placeholders.
   */
  queryParams?: Record<string, string>;

  /**
   * Request body for POST requests. Values support {username} and {userId} placeholders.
   */
  body?: Record<string, unknown>;

  /**
   * Dot-notation path to extract the OTP from the response body.
   * Example: "data.otp". Defaults to "otp".
   */
  responsePath?: string;
}

interface IOTPVerificationConfig {
  baseUrl: string;

  /**
   * Path supporting {username}, {userId}, and {otp} placeholders.
   */
  path: string;

  method?: "GET" | "POST";
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;

  /**
   * Request body. Values support {username}, {userId}, and {otp} placeholders.
   */
  body?: Record<string, unknown>;

  /** Dot-notation path to the access token in the verification response. Defaults to "accessToken". */
  accessTokenPath?: string;

  /** Dot-notation path to the refresh token in the verification response. Defaults to "refreshToken". */
  refreshTokenPath?: string;
}
```

---

### OIDC Configuration — `IOIDCConfig`

A structured alternative to the flat `oidcProvider` field. When both are present, `oidcConfig` takes priority. Available on both `IAuthConfig` and `IUser` for per-user overrides.

```typescript
interface IOIDCConfig {
  /**
   * The OIDC provider.
   * One of: "okta" | "auth0" | "azure-ad" | "keycloak" | "cognito" | "ping"
   */
  provider: OIDCProvider;

  /** OAuth2 client ID registered with the provider. */
  clientId?: string;

  /** OAuth2 client secret. */
  clientSecret?: string;

  /** Issuer URL of the provider. Example: "https://dev-12345.okta.com" */
  issuer?: string;

  /**
   * The callback URL your application is registered to receive the auth code at.
   * When set, overrides the default "<BASE_SERVER_URL>/auth/oidc/callback".
   */
  redirectUri?: string;

  /** OAuth2 scopes to request. Example: "openid profile email" */
  scope?: string;

  /**
   * URL of a local mock OIDC server.
   * When set, overrides BASE_SERVER_URL as the base for the callback URL.
   */
  mockServerUrl?: string;
}
```

**Example — using `oidcConfig` for a user with a specific mock server:**

```typescript
// users.json
[
  {
    "username": "sso-user@example.com",
    "authType": "oidc",
    "oidcConfig": {
      "provider": "okta",
      "mockServerUrl": "http://localhost:3019",
      "redirectUri": "http://localhost:3019/auth/oidc/callback"
    }
  }
]
```

---

### API Auth Configuration — `IAPIAuthConfig`

Used when `isApi: true`. Describes the HTTP login endpoint and how to extract and apply the resulting token.

```typescript
interface IAPIAuthConfig {
  /**
   * Endpoint path appended to actionUrl.
   * Example: "/api/auth/login"
   * Note: actionUrl must be the API origin only (e.g. "http://localhost:3000")
   * when isApi is true. Do not include the path in actionUrl.
   */
  path: string;

  /**
   * Maps your API's field names to the standard "username" and "password" keys.
   * Example: { username: "email", password: "passphrase" }
   */
  fieldMap?: {
    username?: string;
    password?: string;
  };

  /**
   * Extra fields to include in the login request body beyond username/password.
   * Example: { "tenantId": "acme-corp", "rememberMe": true }
   */
  additionalFields?: Record<string, unknown>;

  /** Additional request headers for the login call. */
  headers?: Record<string, string>;

  /**
   * Dot-notation path to the token in the login response body.
   * Only used when tokenType is "bearer" or "custom-header".
   * Example: "data.token" or "auth.accessToken". Defaults to "token".
   */
  tokenPath?: string;

  /**
   * How the token is applied to subsequent requests in the browser context.
   *
   * "cookie"        — no token extraction needed; the session cookie is inherited.
   * "bearer"        — extracted token set as "Authorization: Bearer <token>".
   * "custom-header" — extracted token set as a custom header.
   *                   Requires tokenHeaderName to also be set.
   */
  tokenType?: "bearer" | "cookie" | "custom-header";

  /**
   * The header name to use when tokenType is "custom-header".
   * Example: "x-session-token"
   */
  tokenHeaderName?: string;
}
```

---

### Token Storage Configuration — `TokenStorageConfig`

Used when your application persists auth tokens in `localStorage` or `sessionStorage` instead of (or in addition to) cookies. When `tokenStorageConfig` is set, `AuthManager.getContext()` reads the saved session file, extracts the token, and injects it as an HTTP header on every browser context it creates.

```typescript
interface TokenStorageConfig {
  /**
   * Which browser storage the app puts the token in.
   * "localStorage"   — persisted across browser restarts.
   * "sessionStorage" — cleared when the tab closes.
   */
  storageType: "localStorage" | "sessionStorage";

  /**
   * The key used in localStorage/sessionStorage.
   * Example: "user", "app_user", "auth"
   */
  storageKey: string;

  /**
   * Dot-notation path into the parsed JSON value to reach the token.
   * Example: "accessToken", "auth.accessToken", "data.token"
   * Leave undefined if the stored value IS the token string directly.
   */
  tokenPath?: string;

  /**
   * The origin the storage entry lives under.
   * Must exactly match the app's origin: "https://staging.example.com"
   * Defaults to BASE_SERVER_URL if not set.
   */
  origin?: string;

  /**
   * Header name to inject the token into for API requests.
   * Defaults to "Authorization".
   */
  headerName?: string;

  /**
   * When true, prepends "Bearer " to the token value.
   * Only applies when headerName is "Authorization" or not set.
   * Defaults to true.
   */
  attachBearer?: boolean;
}
```

**Example — app that stores a JWT in `localStorage` under the key `"user"`:**

```typescript
// base.config.ts
export const BASE_CONFIG: IAuthConfig = {
  // ...
  tokenStorageConfig: {
    storageType: "localStorage",
    storageKey: "user",
    tokenPath: "accessToken",          // extracts parsed_json.accessToken
    origin: "https://staging.example.com",
    attachBearer: true,                // injects "Authorization: Bearer <token>"
  },
};
```

**Per-user override** — useful when different users store tokens under different keys:

```json
[
  {
    "username": "admin@example.com",
    "tokenStorageConfig": {
      "storageType": "sessionStorage",
      "storageKey": "admin_auth",
      "tokenPath": "data.token"
    }
  }
]
```

> **sessionStorage note:** Playwright's `storageState()` does not capture sessionStorage by default. `qa-pwmaf` works around this by explicitly snapshotting sessionStorage from every open page at the end of authentication and re-injecting it via `addInitScript` when a context is later loaded. This happens automatically — no extra config is needed.

---

## Environment Variables

The framework reads the following environment variables. Add them to your `.env` file:

```dotenv
# ─── REQUIRED ──────────────────────────────────────────────────────────────────

# Relative (from project root) or absolute path to your users.json file.
# The framework will throw a startup error if this is not set.
AUTH_USERS_FILE=src/data/users.json

# Whether API authentication is enabled for this test run.
# Must be "true" or "false".
USE_API=false

# ─── OPTIONAL ──────────────────────────────────────────────────────────────────

# Override the authType at runtime without editing base.config.ts.
# Useful for running different auth flows from the same codebase in CI.
# AUTH_TYPE=email-password

# A static OTP value for use when otpConfig.source is "env".
# TEST_OTP=123456

# Set to "1" to validate that each user's actionUrl is reachable before setup.
# VALIDATE_USER_URLS=1
```

The `AUTH_USERS_FILE` variable is how `getOrCreateAuthManager()` finds your users file at runtime without you passing the path explicitly. The framework resolves the path relative to the project root (where `package.json` lives). If `AUTH_USERS_FILE` is not set, the framework defaults to `src/data/users.json`.

---

## Users File — `users.json`

Store your test credentials in a JSON array. Each object maps to the `IUser` interface.

**Minimal example (email/password):**

```json
[
  { "username": "admin@example.com", "password": "AdminPass1!" },
  { "username": "user@example.com",  "password": "UserPass1!"  }
]
```

**With roles and per-user overrides:**

```json
[
  {
    "username": "admin@example.com",
    "password": "AdminPass1!",
    "role": "admin"
  },
  {
    "username": "user@example.com",
    "password": "UserPass1!",
    "role": "user"
  },
  {
    "username": "sso-user@example.com",
    "role": "user",
    "authType": "oidc",
    "oidcConfig": {
      "provider": "okta"
    }
  }
]
```

> **Security note:** `users.json` contains real credentials. Add it to `.gitignore`. Use environment-variable substitution or a secrets manager when deploying in CI environments.

---

## Auth Strategies

### Email/Password (Browser)

The framework navigates to your login page, fills in the email and password fields, clicks submit, and waits for the `successUrl`.

```typescript
// base.config.ts
export const BASE_CONFIG: IAuthConfig = {
  actionUrl: "http://localhost:3000/login",
  mode: "multi",
  authType: "email-password",
  authPageLayout: "single-page",   // or "progressive-reveal"
  successUrl: "**/dashboard**",
  storageStatePath: ".auth",
  BASE_SERVER_URL: "http://localhost:3000",
  selectors: {},
  users: [],
};
```

Supported layouts:

- `"single-page"` — email and password are both visible immediately. The framework fills them and clicks submit once.
- `"progressive-reveal"` — the framework fills the email, clicks submit, waits for the password field to become visible, then fills the password and clicks submit again.

> `"redirect-to-new-page"` is **not supported** for email/password and will throw at runtime.

---

### Email/Password (API)

Bypasses the browser UI entirely. The framework sends a `POST` to your login endpoint and extracts the resulting token or cookie.

```typescript
export const BASE_CONFIG: IAuthConfig = {
  actionUrl: "http://localhost:3000",  // origin only — no path
  authType: "email-password",
  isApi: true,
  apiConfig: {
    path: "/api/auth/login",
    fieldMap: { username: "email", password: "password" },
    tokenType: "bearer",
    tokenPath: "data.accessToken",
  },
  // ... other required fields
};
```

---

### Email OTP

The user enters their email and receives an OTP. No password is involved.

```typescript
export const BASE_CONFIG: IAuthConfig = {
  actionUrl: "http://localhost:3000/login",
  authType: "email-otp",
  authPageLayout: "single-page",
  successUrl: "**/home**",
  otpConfig: {
    mode: "single-input",
    strategy: "single-input",
    autoSubmit: false,
    source: "api-request",
    requestConfig: {
      baseUrl: "http://localhost:3000",
      path: "/api/otp/send",
      method: "POST",
      body: { email: "{username}" },
      responsePath: "data.otp",
    },
    verifyConfig: {
      baseUrl: "http://localhost:3000",
      path: "/api/otp/verify",
      method: "POST",
      body: { email: "{username}", code: "{otp}" },
      accessTokenPath: "token",
    },
  },
  storageStatePath: ".auth",
  BASE_SERVER_URL: "http://localhost:3000",
  selectors: {},
  users: [],
};
```

---

### Email/Password + OTP

The user enters email and password, then is prompted for an OTP as a second factor.

```typescript
export const BASE_CONFIG: IAuthConfig = {
  actionUrl: "http://localhost:3000/login",
  authType: "email-password-otp",
  authPageLayout: "single-page",
  successUrl: "**/dashboard**",
  otpConfig: {
    mode: "segmented",
    strategy: "multi-input",
    fieldCount: 6,
    autoSubmit: true,
    source: "env",
    envKey: "TEST_OTP",
  },
  storageStatePath: ".auth",
  BASE_SERVER_URL: "http://localhost:3000",
  selectors: {},
  users: [],
};
```

---

### OAuth 2.0

> **Important:** The OAuth strategy intercepts the provider redirect at the network level and replaces it with a mock callback response. This means your application backend must handle the mock callback and create a session. This approach is suitable for testing your application's OAuth integration without making real calls to Google/GitHub/etc.

Supported providers: `"google"`, `"github"`, `"microsoft"`, `"facebook"`

```typescript
export const BASE_CONFIG: IAuthConfig = {
  actionUrl: "http://localhost:3000/login",
  authType: "oauth",
  oauthProvider: "google",
  successUrl: "**/dashboard**",
  storageStatePath: ".auth",
  BASE_SERVER_URL: "http://localhost:3000",
  selectors: {
    googleOAuthButton: "button:has-text('Sign in with Google')",
  },
  users: [],
};
```

---

### OIDC

The OIDC strategy intercepts your provider's `/authorize` request and immediately returns a mock `code` to your application's callback endpoint. Supported providers: `"okta"`, `"auth0"`, `"azure-ad"`, `"keycloak"`, `"cognito"`, `"ping"`.

You can configure the provider via the flat `oidcProvider` field or the structured `oidcConfig` field — `oidcConfig` takes priority when both are present.

```typescript
export const BASE_CONFIG: IAuthConfig = {
  actionUrl: "http://localhost:3000/login",
  authType: "oidc",
  oidcProvider: "okta",  // flat form
  // OR use structured form:
  // oidcConfig: { provider: "okta", mockServerUrl: "http://localhost:3019" },
  successUrl: "**/dashboard**",
  storageStatePath: ".auth",
  BASE_SERVER_URL: "http://localhost:3009",
  selectors: {
    ssoButton: "#enterprise-login-btn",
  },
  users: [],
};
```

To override the intercept pattern for a non-standard provider URL:

```typescript
export const BASE_CONFIG: IAuthConfig = {
  // ...
  OIDCProviderPatterns: {
    okta: "**/my-custom-okta-domain.com/oauth2/**/authorize**",
  },
};
```

---

### SAML

The SAML strategy navigates to your application's SAML login initiation endpoint (constructed as `<BASE_SERVER_URL>/auth/saml/login/<username>`) and waits for the application to redirect to `successUrl` after completing the SAML assertion exchange. A real or mock SAML IdP must be running and configured in your application for this to work.

Supported providers: `"okta"`, `"azure"`, `"onelogin"`, `"ping"`, `"adfs"`

```typescript
export const BASE_CONFIG: IAuthConfig = {
  actionUrl: "http://localhost:3000/login",
  authType: "saml",
  samlProvider: "okta",
  successUrl: "**/dashboard**",
  storageStatePath: ".auth",
  BASE_SERVER_URL: "http://localhost:3000",
  selectors: {},
  users: [],
};
```

---

### Custom Strategy

If your application uses an authentication flow not covered by the built-in strategies, implement the `IAuthStrategy` interface:

```typescript
import type { IAuthStrategy, AuthResult, IAuthConfig, IUser, PWBrowser } from "qa-pwmaf";

export class MagicLinkStrategy implements IAuthStrategy {
  async authenticate(
    browser: PWBrowser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult> {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Your custom auth logic here
    await page.goto(config.actionUrl);
    // ... trigger magic link, intercept token, etc.

    return {
      context,
      metadata: {
        authType: "custom",
        username: user.username,
      },
    };
  }
}
```

Register it in your config:

```typescript
import { MagicLinkStrategy } from "./strategies/MagicLinkStrategy";

export const BASE_CONFIG: IAuthConfig = {
  authType: "custom",
  customStrategy: new MagicLinkStrategy(),
  // ... other fields
};
```

---

## Integrating with Playwright — Global Setup

Create a `global-setup.ts` at the root of your test project:

```typescript
// global-setup.ts
import { chromium, FullConfig } from "@playwright/test";
import { getOrCreateAuthManager } from "qa-pwmaf";

export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const manager = await getOrCreateAuthManager();
  await manager.setup(browser);
  await browser.close();
}
```

Wire it into your Playwright config:

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./global-setup.ts",

  use: {
    // Apply the default user session to all tests.
    storageState: ".auth/user@example.com.json",
  },

  projects: [
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/admin@example.com.json",
      },
      testMatch: "**/admin/**/*.spec.ts",
    },
    {
      name: "user",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user@example.com.json",
      },
      testMatch: "**/user/**/*.spec.ts",
    },
  ],
});
```

---

## Using Sessions in Tests

### Applying a user's session to a test

```typescript
// my-test.spec.ts
import { test, expect } from "@playwright/test";

// The storageState is applied at the project/config level, so you
// simply navigate — Playwright has already loaded the session cookies.
test("admin can see the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("h1")).toContainText("Welcome, Admin");
});
```

### Switching between users inside a single test

```typescript
import { test, expect } from "@playwright/test";
import { getOrCreateAuthManager } from "qa-pwmaf";

test("approval flow across two users", async ({ browser }) => {
  const manager = await getOrCreateAuthManager();

  const adminContext = await manager.getContext("admin@example.com", browser);
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin/approvals");
  await adminPage.locator("#approve-btn").click();
  await adminContext.close();

  const userContext = await manager.getContext("user@example.com", browser);
  const userPage = await userContext.newPage();
  await userPage.goto("/notifications");
  await expect(userPage.locator(".approval-notice")).toBeVisible();
  await userContext.close();
});
```

### Checking for and refreshing expired sessions

```typescript
import { getOrCreateAuthManager } from "qa-pwmaf";

// In a custom fixture or a beforeAll hook:
const manager = await getOrCreateAuthManager();
const session = await manager.readSession("admin@example.com");
// readSession automatically re-authenticates if the session is expired.
```

### Using the `authFile` helper

```typescript
import { authFile } from "qa-pwmaf";

// Returns ".auth/<username>.json"
const sessionPath = authFile("admin@example.com");
const context = await browser.newContext({ storageState: sessionPath });
```

### Using `ensureValidSession`

```typescript
import { ensureValidSession } from "qa-pwmaf";

// Checks if the session file exists and is not expired.
// If expired or missing, triggers re-authentication.
await ensureValidSession("admin@example.com", browser);
```

---

## Playwright Test Fixtures

`qa-pwmaf` exports a Playwright `test` object pre-extended with auth fixtures. Import it in place of the standard `@playwright/test` `test` for access to auth-aware helpers in every test:

```typescript
import { test, expect } from "qa-pwmaf/fixtures"; // or from "qa-pwmaf"
```

The extended `test` provides these additional fixtures:

| Fixture | Type | Description |
|---|---|---|
| `authManager` | `AuthManager` | The singleton `AuthManager` instance, already initialized. |
| `authConfig` | `IAuthConfig` | The loaded and merged configuration. |
| `getUserConfig` | `(username: string) => IAuthConfig` | Returns the merged effective config for a specific user (root config + user-level overrides). |
| `getContext` | `(username: string) => Promise<BrowserContext>` | Creates a browser context pre-loaded with the saved session for the given user. Contexts created via this fixture are automatically closed after the test. |

```typescript
import { test, expect } from "qa-pwmaf";

test("admin sees management panel", async ({ getContext }) => {
  const ctx = await getContext("admin@example.com");
  const page = await ctx.newPage();
  await page.goto("/admin");
  await expect(page.locator("h1")).toContainText("Management");
});
```

> **Note:** The `getContext` fixture handles automatic context teardown. Prefer it over calling `authManager.getContext()` directly inside test bodies.

---

## Per-User Auth Overrides

Any field in `IAuthConfig` that also exists in `IUser` can be overridden at the user level. This allows a single `base.config.ts` to handle a heterogeneous set of users who log in through different flows.

**Example scenario:** A SaaS application where admins log in via SAML SSO, internal QA users log in via email/password, and external API consumers authenticate via an API endpoint.

```json
[
  {
    "username": "admin@corp.example.com",
    "authType": "saml",
    "samlProvider": "azure"
  },
  {
    "username": "qa@example.com",
    "password": "qaPass123!",
    "authType": "email-password"
  },
  {
    "username": "api-consumer@example.com",
    "password": "apiPass456!",
    "isApi": true,
    "apiConfig": {
      "path": "/api/v2/sessions",
      "tokenType": "bearer",
      "tokenPath": "session.token"
    }
  }
]
```

The root `base.config.ts` can have any `authType` as its default — each user's entry overrides only the fields it specifies, inheriting everything else from the root config.

---

## Session Lifecycle — Events & Reporter

The framework emits typed events throughout the authentication lifecycle. You can hook into these for custom logging, alerting, or metrics.

### Available Events

| Event | Payload | When it fires |
|---|---|---|
| `session:saved` | `{ filePath, enriched, userId, authType, savedAt }` | A session file has been written to disk |
| `session:read` | `{ filePath, state }` | A session file has been read |
| `session:deleted` | `{ filePath }` | A session file has been deleted |
| `session:failed` | `{ filePath, error }` | A session save or read operation failed |

### Using `authEvents` directly

```typescript
import { authEvents } from "qa-pwmaf";

authEvents.on("session:saved", ({ filePath, enriched, authType }) => {
  console.log(`[AUTH] Session saved: ${filePath} (authType: ${authType})`);
  console.log(`  Cookies: ${enriched.cookies.length}, Origins: ${enriched.origins.length}`);
});

authEvents.on("session:failed", ({ filePath, error }) => {
  console.error(`[AUTH ERROR] Failed to save session at ${filePath}: ${error.message}`);
});
```

### Using `AuthReporter`

`AuthReporter` is a convenience class that attaches listeners for all events and stores structured log entries for later retrieval:

```typescript
import { AuthReporter } from "qa-pwmaf";

const reporter = new AuthReporter();
reporter.attach();  // starts listening for all session events

// After global setup completes:
const logs = reporter.getLogs();
console.log("All auth events:", logs);

reporter.clear();  // reset logs between test runs
```

---

## API Reference

### `getOrCreateAuthManager(): Promise<AuthManager>`

Returns a promise that resolves to the singleton `AuthManager` instance for the current process. On the first call it reads `AUTH_USERS_FILE` from the environment, loads `base.config.ts` from the project root, runs config validation, optionally clears the auth store if `deleteAuthStorageOnTestRun` is set, and creates the instance. Subsequent calls return the same instance without re-reading config.

```typescript
const manager = await getOrCreateAuthManager();
```

### `AuthManager`

| Method | Signature | Description |
|---|---|---|
| `setup` | `(browser: PWBrowser) => Promise<void>` | Authenticates all configured users and saves their sessions to disk. Called once in `globalSetup`. |
| `getContext` | `(username, browser) => Promise<PWContext>` | Returns a new browser context pre-loaded with the saved session for the given user. Injects token headers automatically when `tokenStorageConfig` is set. |
| `readSession` | `(username) => Promise<EnrichedStorageState \| null>` | Reads the saved session for a user. Triggers re-authentication if the session is expired. |
| `reauthenticateUser` | `(username, browser) => Promise<PWContext>` | Forces a fresh login for the given user, deleting the old session file first. |
| `logoutSession` | `(username) => Promise<void>` | Closes the in-memory context and deletes the session file for the given user. |
| `teardown` | `() => Promise<void>` | Closes all open contexts and deletes all session files. Call in `globalTeardown`. |
| `authConfig` | `IAuthConfig` | Read-only access to the loaded config. |
| `getUserEffectiveConfig` | `(username) => IAuthConfig` | Returns the merged config for a specific user (root config + user-level overrides). |

### `createAuthConfig(usersPath: string): Promise<IAuthConfig>`

Loads `base.config.ts` from the project root and merges in the users from the JSON file at `usersPath`. Returns a fully assembled `IAuthConfig`. If `VALIDATE_USER_URLS=1` is set in the environment, it also checks that each user's `actionUrl` is reachable before returning.

### `deleteAuthStore(folderPath: string): Promise<void>`

Deletes the directory at `folderPath` (resolved from the project root) and all session files inside it. Called automatically by `getOrCreateAuthManager()` when `deleteAuthStorageOnTestRun: true` is set. Also available for use in custom teardown scripts.

```typescript
import { deleteAuthStore } from "qa-pwmaf";

// In globalTeardown, if you want to wipe sessions after every run:
await deleteAuthStore(".auth");
```

### `validateConfig(config: IAuthConfig): void`

Validates the assembled config against all structural rules. Throws a `ConfigValidationError` with a formatted list of all errors and warnings if any rules are violated.

### `AuthPage`

A Playwright page object wrapping the login form. Instantiated internally by each strategy, but also exported for use in custom strategies.

```typescript
import { AuthPage } from "qa-pwmaf";

const authPage = new AuthPage(page, selectors);

await authPage.fillEmail("user@example.com");
await authPage.fillPassword("password");
await authPage.submitPassword();

// Unified OTP fill — strategy drives the DOM interaction:
// "single-input"  → fills a standard visible text input
// "hidden-input"  → types into a browser-managed hidden field (autocomplete="one-time-code")
// "multi-input"   → fills each digit box individually
await authPage.fillOTP(otp, "single-input");
await authPage.fillOTP(otp, "hidden-input");
await authPage.fillOTP(otp, "multi-input", 6);
```

### `isTokenExpired(storage, opts?): boolean`

Checks whether a stored session is expired by inspecting the JWT cookie payload and/or the `savedAt` / `expiresAt` metadata fields.

### `extractToken(state, config, fallbackOrigin?): string | null`

Extracts a token from a saved `EnrichedStorageState` object according to a `TokenStorageConfig`. Supports both `localStorage` and `sessionStorage`. Returns `null` if the token cannot be found.

```typescript
import { extractToken } from "qa-pwmaf";

const token = extractToken(state, {
  storageType: "localStorage",
  storageKey: "user",
  tokenPath: "accessToken",
}, "https://staging.example.com");
```

### `getTokenFromFile(username, storageStatePath, config, fallbackOrigin?): string | null`

Reads a user's saved session file from disk and extracts a token using a `TokenStorageConfig`. Useful in helpers, fixtures, or custom setup code where you need the raw token value.

```typescript
import { getTokenFromFile } from "qa-pwmaf";

const token = getTokenFromFile("admin@example.com", ".auth", {
  storageType: "sessionStorage",
  storageKey: "auth",
  tokenPath: "data.token",
});
```

### `buildApiUrl(baseUrl, path?): string`

Safely combines an origin URL with a path, throwing a descriptive error if the baseUrl already contains a path (which indicates a misconfiguration when using API auth).

### `authFile(username: string): string`

Returns the path `.auth/<username>.json`.

### `ensureValidSession(username, browser): Promise<void>`

Checks whether the session file for `username` exists and is not expired. If the session is expired or missing, it calls `reauthenticateUser` automatically. Useful in `beforeAll` hooks or custom fixtures.

### `validateUserEndpoints(users): Promise<void>`

Iterates over a list of users and makes an HTTP request to each user's `actionUrl`, throwing if any endpoint is unreachable. Activated automatically when `VALIDATE_USER_URLS=1` is set. Can also be called directly in custom setup code.

---

## Type Reference

All types are exported from the root package entry point:

```typescript
import type {
  IAuthConfig,
  IUser,
  AuthType,
  AuthMode,
  AuthPageLayout,
  OTPMode,
  OTPSource,
  OAuthProvider,
  OIDCProvider,
  IOIDCConfig,
  SAMLProvider,
  TokenType,
  IOTPConfig,
  IOTPRequestConfig,
  IOTPVerificationConfig,
  IAPIAuthConfig,
  IAPIFieldMap,
  AuthOverrideSelectors,
  AuthSession,
  StorageState,
  EnrichedStorageState,
  StorageStateMetadata,
  TokenStorageType,
  TokenStorageConfig,
  otpStrategy,
  PWBrowser,
  PWContext,
  PWPage,
  PWLocator,
  UserRole,
  BaseFixtures,
} from "qa-pwmaf";
```

The `IAuthStrategy` interface and `AuthResult` type are also exported from the root:

```typescript
import type { IAuthStrategy, AuthResult } from "qa-pwmaf";
```

The package also provides sub-path exports for targeted imports:

```typescript
import type { IAuthConfig } from "qa-pwmaf/config";
import type { IUser, AuthType }  from "qa-pwmaf/types";
```

---

## What qa-pwmaf Covers

| Feature | Status |
|---|---|
| Email + Password login (browser, single-page) | ✅ Supported |
| Email + Password login (browser, progressive-reveal) | ✅ Supported |
| Email + Password login (API, cookie) | ✅ Supported |
| Email + Password login (API, Bearer token) | ✅ Supported |
| Email + Password login (API, custom header) | ✅ Supported |
| Email OTP login (browser, single-input or segmented) | ✅ Supported |
| Email OTP login (API) | ✅ Supported |
| Email + Password + OTP (browser) | ✅ Supported |
| Email + Password + OTP (API) | ✅ Supported |
| OTP from environment variable | ✅ Supported |
| OTP via network interception | ✅ Supported |
| OTP via direct API request | ✅ Supported |
| OTP strategy: single visible input | ✅ Supported |
| OTP strategy: hidden input (autocomplete="one-time-code") | ✅ Supported |
| OTP strategy: multi-input digit boxes | ✅ Supported |
| OAuth 2.0 (Google, GitHub, Microsoft, Facebook) — mock | ✅ Supported |
| OIDC (Okta, Auth0, Azure AD, Keycloak, Cognito, Ping) — mock | ✅ Supported |
| OIDC via structured `oidcConfig` (provider, redirectUri, mockServerUrl) | ✅ Supported |
| SAML (Okta, Azure, OneLogin, Ping, ADFS) | ✅ Supported |
| Multi-user / multi-role session management | ✅ Supported |
| Per-user auth type overrides | ✅ Supported |
| Session persistence (Playwright storageState) | ✅ Supported |
| sessionStorage capture and restoration | ✅ Supported |
| Token extraction from localStorage / sessionStorage | ✅ Supported |
| Automatic header injection from stored token | ✅ Supported |
| Session expiry detection (JWT + metadata) | ✅ Supported |
| Automatic re-authentication on expiry | ✅ Supported |
| Parallel user authentication | ✅ Supported |
| Sequential auth for rate-limited apps | ✅ Supported |
| Auth retry with configurable backoff | ✅ Supported |
| Config auto-discovery from project root | ✅ Supported |
| TypeScript + JavaScript config support | ✅ Supported |
| Full config validation with descriptive errors | ✅ Supported |
| Interactive CLI config generator | ✅ Supported |
| CLI preset mode | ✅ Supported |
| Custom strategy extension point | ✅ Supported |
| Session event system (EventEmitter) | ✅ Supported |
| Session metadata enrichment (savedAt, authType) | ✅ Supported |
| Strategy step-by-step debug logging | ✅ Supported |
| Playwright test fixtures (authManager, authConfig, getContext) | ✅ Supported |
| Auth store cleanup utility (`deleteAuthStore`) | ✅ Supported |
| User endpoint reachability validation (`VALIDATE_USER_URLS`) | ✅ Supported |

---

## What Is Not Yet Supported

The following features are either planned or out of scope for the current version. Contributions addressing these gaps are very welcome — please read the Contributing section before opening a PR.

| Feature | Notes |
|---|---|
| **Real OAuth provider login** | The current OAuth strategy mocks the provider redirect at the network layer. Driving a real Google/GitHub login UI (CAPTCHA, actual IdP credentials) is not yet supported. |
| **Real OIDC provider login** | Same as OAuth — the OIDC strategy intercepts the authorize request and returns a mock code. Real IdP UI interaction is not covered. |
| **WebAuthn / Passkeys** | Platform authenticator flows (Face ID, Touch ID, hardware keys) require Playwright's WebAuthn emulation API which is not yet integrated. |
| **Magic link authentication** | Triggering and following a magic login link requires either email inbox access (via API) or a static redirect — not yet built in. |
| **SMS OTP delivery** | The `OtpDeliveryChannel` type includes `"sms"` but the SMS channel is not yet implemented. Only email-based and API-based OTP are active. |
| **Authenticator app TOTP** | Time-based OTPs from apps like Google Authenticator require a TOTP algorithm integration (e.g. `otplib`). Not yet supported. |
| **Phone number authentication** | Login flows that begin with a phone number rather than an email are not covered. |
| **Token refresh** | `refreshToken` is captured and stored in session metadata but active token refresh (calling a refresh endpoint before expiry) is not yet automatic. |
| **Remote / distributed session store** | Sessions are saved to the local filesystem. There is no built-in adapter for Redis, S3, or a shared network path for multi-worker distributed Playwright runs. |
| **Pre/post auth hooks** | There is no plugin hook system for running custom code before or after the authentication step within a strategy. |
| **Custom SAML assertion handling** | The SAML strategy follows the SP-initiated flow but does not support custom assertion attributes, encrypted assertions, or multi-step SAML flows. |
| **LinkedIn OAuth** | The `linkedInOAuthButton` selector exists but LinkedIn is not yet in the supported `OAuthProvider` type union or the route intercept map. |
| **Twitter/X OAuth** | Twitter/X is in the internal provider patterns map but not in the public type union. |

---

## Contributing

### Branch model

```
master ← staging ← develop ← feature/your-branch
```

- All work starts from `develop`
- PRs merge `develop → staging`, then `staging → master`
- **`master` and `staging` are protected** — CI must pass before any merge is allowed
- Direct pushes to `master` or `staging` are blocked

---

### Before you open a PR

```bash
npm ci
npm run typecheck      # must pass with zero errors
npm test               # Jest unit tests — must all pass
npx playwright test    # integration tests — must all pass locally
```

---

### Mandatory test file rule

**Every PR that touches source code must include or update a test file.**
This is enforced by the PR checklist and verified in code review.
PRs without matching test updates will not be merged.

#### Which file do I need to update?

| Source area | Test file |
|---|---|
| `src/core/AuthFactory.ts` | `tests/strategies/auth-factory.spec.ts` |
| `src/strategeies/EmailPasswordStrategy.ts` (browser) | `tests/strategies/email-password.browser.spec.ts` |
| `src/strategeies/EmailPasswordStrategy.ts` (API) | `tests/strategies/email-password.api.spec.ts` |
| `src/strategeies/EmailOTPStrategy.ts` (browser) | `tests/strategies/email-otp.browser.spec.ts` |
| `src/strategeies/EmailOTPStrategy.ts` (API) | `tests/strategies/email-otp.api.spec.ts` |
| `src/strategeies/EmailPasswordOTPStrategy.ts` (browser) | `tests/strategies/email-password-otp.browser.spec.ts` |
| `src/strategeies/EmailPasswordOTPStrategy.ts` (API) | `tests/strategies/email-password-otp.api.spec.ts` |
| `src/strategeies/OAuthStrategy.ts` | `tests/strategies/oauth.spec.ts` |
| `src/strategeies/OIDCStrategy.ts` | `tests/strategies/oidc.spec.ts` |
| `src/strategeies/SAMLStrategy.ts` | `tests/strategies/saml.spec.ts` |
| Custom strategy extension point (`IAuthStrategy`) | `tests/strategies/custom-strategy.spec.ts` |
| `src/core/AuthManager.ts` | `tests/core/auth-manager.spec.ts` |
| `src/core/OtpResolver.ts` | `tests/core/otp-resolver.spec.ts` |
| `src/utils/tokenStorage.ts` / `TokenStorageConfig` | `tests/core/token-storage.spec.ts` |
| `src/configs/validate-config.ts` / `ConfigValidationError` | `tests/core/config-validation.spec.ts` |
| `src/core/AuthEvents.ts` / `src/core/AuthReporter.ts` | `tests/core/auth-events.spec.ts` |
| Session file shape / `EnrichedStorageState` | `tests/session/persistence.spec.ts` |
| `/api/me` integrity / role assertions | `tests/session/integrity.spec.ts` |
| Session isolation / cross-contamination | `tests/session/isolation.spec.ts` |
| Session expiry / stale file handling | `tests/session/expiry.spec.ts` |
| API strategy error paths | `tests/error-paths/api-errors.spec.ts` |
| `src/types.ts` | Whichever spec exercises the changed type |

#### What does "update a test file" mean?

1. **New feature** → add new `test()` blocks inside the relevant spec file
2. **Bug fix** → add a regression test that would have caught the bug
3. **Type/interface change** → update the test that exercises that type; add a new test if the change introduces new validation rules
4. **Rename / restructure** → update imports and descriptions in the relevant spec

Every test update must cover at minimum the happy path and at least one error path.

---

### Adding a new auth strategy

If you're adding a new strategy (e.g. `MagicLinkStrategy`), create **two new spec files**:

```
tests/strategies/magic-link.browser.spec.ts   ← browser flow
tests/strategies/magic-link.api.spec.ts       ← API path (if isApi: true is supported)
```

Add the strategy to the table in this file, the PR template, and the README.

Also update `tests/strategies/auth-factory.spec.ts` to assert that
`AuthFactory.getStrategy({ authType: "magic-link" })` returns your new class.

---

### Test file structure conventions

Each spec file follows this pattern:

```typescript
/**
 * <filename>.spec.ts — <area> (<section refs>)
 *
 * WHAT THIS FILE TESTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  §N  Section title — what is verified and why
 */

// shared helper functions (u(), eff(), runStrategy(), etc.)

test.describe("§N Section Title", () => {
  test("scenario: expected outcome", async ({ browser, authConfig }) => {
    // arrange
    // act
    // assert — always end with at least one expect()
  });
});
```

Rules:

- **One `test.describe` per numbered section** (`§1`, `§2`, etc.)
- **Test titles state the scenario and the expected outcome** — not what the code does
- **No `test.only`** in committed code — it blocks the entire suite
- **No `test.skip`** without a linked issue number in a comment

---

### CI pipeline

```
typecheck → unit (Jest) → build → E2E (strategies / api / session / core)
                                         ↓
                                  all-checks-pass  ←── branch protection points here
```

Every PR must pass the `all-checks-pass` job before it can merge.
The `release.yml` workflow publishes to npm **only** after `all-checks-pass` succeeds on `master`.

#### Running a specific CI slice locally

```bash
# strategies only
npx playwright test tests/strategies/

# API mode
USE_API=true npx playwright test tests/strategies/ tests/error-paths/

# core utilities (no browser needed for unit tests)
npm test -- tests/core/config-validation.spec.ts
npm test -- tests/core/auth-events.spec.ts
```

---

### Coverage gaps to be aware of

The following areas currently have reduced or partial coverage.
If your PR touches these, adding tests is especially appreciated:

| Area | Gap |
|---|---|
| `hidden-input` OTP strategy | Only structural tests — needs a mock server page with `autocomplete="one-time-code"` |
| `TokenStorageConfig` header injection | Integration tests rely on `/api/echo-headers` endpoint not yet in all mocks |
| `AuthReporter.attach()` idempotency | Documented as "at most 2" — needs enforcement and a hard assertion |
| `authFile()` utility | Used everywhere, never unit-tested directly |
| `buildApiUrl()` | Edge cases (path included in origin) untested |
| CLI (`pwmaf init`) | Zero tests — any CLI change should add a test |

---

### Step-by-step contribution workflow

```bash
# 1. Make sure you are on the develop branch and it is up to date
git checkout develop
git pull origin develop

# 2. Create your feature branch from develop
git checkout -b feature/my-feature-name

# 3. Write your code (manually — see AI policy below)

# 4. Build and verify
npm run typecheck
npm run build
npm test

# 5. Commit your changes
git add .
git commit -m "feat: add X support to Y strategy"

# 6. Push your feature branch to your fork (NOT to main/master/staging)
git push origin feature/my-feature-name

# 7. Open a Pull Request targeting the develop branch of the upstream repo
#    PR title should follow Conventional Commits: "feat:", "fix:", "docs:", etc.
```

### PR Requirements

- Target branch must be **`develop`**. PRs targeting `staging` or `master` directly will not be accepted.
- Include a clear description of what was changed and why.
- Reference any related GitHub Issue(s).
- All CI checks must pass.
- At least one maintainer review is required before merging.

### Commit style

```
feat: add hidden-input OTP strategy
fix: restore sessionStorage on context creation
test: add token-storage coverage for dot-notation tokenPath
docs: update README with TokenStorageConfig section
chore: bump version to 0.2.10
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`

---

## AI Usage Policy

`qa-pwmaf` is a hand-crafted codebase. The following rule applies to all contributors:

> **AI tools (GitHub Copilot, ChatGPT, Claude, etc.) may only be used for documentation purposes — writing or improving comments, README sections, and JSDoc. All source code must be written manually by the contributor.**

This policy exists to maintain code quality, ensure that contributors understand what they are submitting, and keep the codebase auditable. Submitting AI-generated logic, strategies, utilities, or tests as your own work is grounds for rejection and may result in being blocked from the project.

If you are unsure whether a specific use of AI is acceptable, open an Issue and ask before submitting a PR.

---

## License

[MIT](https://opensource.org/licenses/MIT) © Emmanuel Eko