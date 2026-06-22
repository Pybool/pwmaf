/**
 * Generates ready-to-fly BASE_CONFIG and users.json templates for every
 * supported auth combination.
 *
 * QA USAGE — two ways to get a config:
 *
 *   1. Interactive CLI (recommended for new setups):
 *      npx pwmaf init
 *      => prompts for auth type, layout, OTP strategy, API vs browser, etc.
 *      => writes base.config.ts + users.json to the chosen location
 *
 *   2. Programmatic (for custom tooling):
 *      import { generateConfig } from "@pwmaf/config-generator";
 *      const { config, users } = generateConfig({
 *        authType:    "email-otp",
 *        otpMode:     "segmented",
 *        otpStrategy: "hidden-input",   // ← the key new field
 *        isApi:       false,
 *        configStyle: "users-file",
 *      });
 *
 * DESIGN DECISIONS
 * ──────────────────
 * OTP mode vs strategy separation
 *   `mode`     = what the UI looks like ("single-input" vs "segmented")
 *   `strategy` = how Playwright actually fills the field
 *
 *   Why this matters: many OTP UIs render 6 segmented boxes but are backed by
 *   a SINGLE hidden <input autocomplete="one-time-code"> behind them.  Filling
 *   each box as if it were an independent <input> fails silently.  The correct
 *   approach is pressSequentially() on the hidden input.  Separating mode from
 *   strategy makes this explicit and avoids site-specific hacks.
 *
 * User objects always include authType / authPageLayout / actionUrl
 *   Every generated user (inline or users.json) explicitly sets these three
 *   fields.  This makes per-user config self-documenting and prevents silent
 *   inheritance bugs when the base config changes.
 *
 * All generated configs pass validateConfig() with zero errors out of the box.
 * Sensitive values (passwords, API keys) are env-var references — safe to commit.
 */

import { TokenStorageConfig } from "../types";

export type AuthType =
  | "email-password"
  | "email-otp"
  | "email-password-otp"
  | "oauth"
  | "oidc"
  | "saml"
  | "custom";

export type OAuthProvider = "google" | "github" | "microsoft" | "facebook";
export type OIDCProvider =
  | "okta"
  | "auth0"
  | "azure-ad"
  | "keycloak"
  | "cognito"
  | "ping";
export type SAMLProvider = "okta" | "azure" | "onelogin" | "ping" | "adfs";
export type OTPSource = "env" | "api-intercept" | "api-request";
export type TokenType = "bearer" | "cookie" | "custom-header";
export type ConfigStyle = "flat" | "users-file";
export type AuthPageLayout =
  | "single-page"
  | "progressive-reveal"
  | "redirect-to-new-page";

/**
 * Visual rendering of the OTP UI ("what it looks like").
 *   "single-input" => one text box for the whole code
 *   "segmented"    => the form shows individual boxes per digit
 */
export type OTPMode = "single-input" | "segmented";

/**
 * Interaction strategy ("how Playwright fills the OTP field").
 *
 *   "single-input"
 *     page.locator('input').first().fill(code)
 *     Use when: one real <input> accepts the full OTP string.
 *     Compatible with mode: "single-input"
 *
 *   "hidden-input"
 *     page.locator('input[autocomplete="one-time-code"]').pressSequentially(code)
 *     Use when: the UI renders individual segmented boxes but they are driven by
 *     a SINGLE hidden <input> behind them (common in Auth0, Cognito, custom libs).
 *     How to tell: open DevTools, the 6 boxes have no real <input> siblings —
 *     only one hidden <input autocomplete="one-time-code"> exists in the DOM.
 *     Compatible with mode: "segmented"
 *
 *   "multi-input"
 *     inputs.nth(i).fill(code[i])  for each digit
 *     Use when: each box IS a genuine separate <input> element.
 *     How to tell: DevTools shows 6 (or N) real <input> elements, one per box.
 *     Compatible with mode: "segmented"
 */
export type OTPStrategy = "single-input" | "hidden-input" | "multi-input";

export interface GeneratorInput {
  /** Auth strategy for the generated config */
  authType: AuthType;

  /** false = browser flow (Playwright fills the login form)
   *  true  = API flow (framework POSTs credentials directly, no browser) */
  isApi: boolean;

  /** "flat"       = single user config, everything on root config, no users.json
   *  "users-file" = root config holds defaults, users.json holds per-user rows */
  configStyle: ConfigStyle;

  /** Base URL of the app under test. No trailing slash. */
  baseUrl?: string;

  /** Login page URL (browser) or API base URL (isApi).
   *  Included on every generated user object so authType changes never silently
   *  break the URL a user navigates to. */
  actionUrl?: string;

  /** How the login form is structured.
   *  Added to every generated user object for self-documentation.
   *  Defaults to "single-page". */
  authPageLayout?: AuthPageLayout;

  /** For authType: "oauth" */
  oauthProvider?: OAuthProvider;
  /** For authType: "oidc" */
  oidcProvider?: OIDCProvider;
  /** For authType: "saml" */
  samlProvider?: SAMLProvider;

  /** Visual rendering of the OTP UI */
  otpMode?: OTPMode;

  /**
   * How Playwright physically interacts with the OTP field.
   * Defaults to "single-input" when otpMode is "single-input",
   * and "multi-input" when otpMode is "segmented".
   * Set explicitly to "hidden-input" for apps that render segmented boxes
   * backed by one hidden <input autocomplete="one-time-code">.
   */
  otpStrategy?: OTPStrategy;

  /** How the OTP code is obtained during the test */
  otpSource?: OTPSource;

  /** Token extraction strategy when isApi is true */
  tokenType?: TokenType;

  /** Add a second admin-role user to the generated users output */
  includeAdminUser?: boolean;

  /** Token storage config for apps that store auth in localStorage/sessionStorage */
  tokenStorageConfig?: TokenStorageConfig;
}

export interface GeneratorOutput {
  /** The base.config.ts file content as a string */
  configFile: string;

  /** The users.json file content (null when configStyle is "flat") */
  usersFile: string | null;

  /** Human-readable notes: what was generated, warnings, next steps */
  notes: string[];
}

// ─── Validation helpers

const BROWSER_ONLY: Set<AuthType> = new Set(["oauth", "oidc", "saml"]);
const OTP_TYPES: Set<AuthType> = new Set(["email-otp", "email-password-otp"]);
const PWD_TYPES: Set<AuthType> = new Set([
  "email-password",
  "email-password-otp",
]);

/**
 * Resolves the effective OTPStrategy from (mode, explicit strategy).
 * Applies the default mapping and validates compatibility.
 * Returns { strategy, warnings }.
 */
function resolveOtpStrategy(
  mode: OTPMode,
  explicit?: OTPStrategy,
): { strategy: OTPStrategy; warnings: string[] } {
  const warnings: string[] = [];

  if (!explicit) {
    return {
      strategy: mode === "segmented" ? "multi-input" : "single-input",
      warnings,
    };
  }

  // Compatibility checks
  if (mode === "single-input" && explicit === "multi-input") {
    warnings.push(
      `⚠️  otpStrategy "multi-input" is unusual with mode "single-input". ` +
        `multi-input fills each digit into a separate nth(i) input — but mode ` +
        `"single-input" implies one field for the full code. ` +
        `Did you mean strategy "single-input" or mode "segmented"?`,
    );
  }
  if (mode === "single-input" && explicit === "hidden-input") {
    warnings.push(
      `⚠️  otpStrategy "hidden-input" with mode "single-input" is uncommon. ` +
        `"hidden-input" uses pressSequentially() on a hidden field — this is ` +
        `designed for visually-segmented UIs. Consider mode "segmented" + ` +
        `strategy "hidden-input" if your OTP UI shows individual boxes.`,
    );
  }
  if (mode === "segmented" && explicit === "single-input") {
    warnings.push(
      `⚠️  otpStrategy "single-input" with mode "segmented" will call fill() ` +
        `on the FIRST input it finds. If your UI has genuine separate inputs per ` +
        `digit, use strategy "multi-input". If it's a hidden input driving ` +
        `visual boxes, use strategy "hidden-input".`,
    );
  }

  return { strategy: explicit, warnings };
}

// ─── Main generator

export function generateConfig(input: GeneratorInput): GeneratorOutput {
  const {
    authType,
    isApi,
    configStyle,
    baseUrl = "http://localhost:3000",
    actionUrl = "http://localhost:3000",
    authPageLayout = "single-page",
    oauthProvider = "google",
    oidcProvider = "okta",
    samlProvider = "okta",
    otpSource = "api-request",
    otpMode = "single-input",
    otpStrategy: rawOtpStrategy,
    tokenType = "cookie",
    includeAdminUser = true,
  } = input;

  const notes: string[] = [];

  // ── Sanity corrections
  const effectiveIsApi = BROWSER_ONLY.has(authType) ? false : isApi;
  if (BROWSER_ONLY.has(authType) && isApi) {
    notes.push(
      `⚠️  authType "${authType}" is browser-only. isApi has been forced to false.`,
    );
  }

  // ── OTP strategy resolution
  const isOtp = OTP_TYPES.has(authType);
  const hasPassword = PWD_TYPES.has(authType);

  let resolvedOtpStrategy: OTPStrategy = "single-input";
  if (isOtp) {
    const { strategy, warnings } = resolveOtpStrategy(otpMode, rawOtpStrategy);
    resolvedOtpStrategy = strategy;
    notes.push(...warnings);
  }

  // ── Config sections
  const otpSection = isOtp
    ? _otpConfigBlock(otpSource, otpMode, resolvedOtpStrategy, baseUrl)
    : null;
  const apiSection = effectiveIsApi ? _apiConfigBlock(tokenType) : null;
  const oauthSection =
    authType === "oauth" ? `  oauthProvider: "${oauthProvider}",\n` : "";
  const oidcSection =
    authType === "oidc" ? `  oidcProvider: "${oidcProvider}",\n` : "";
  const samlSection =
    authType === "saml" ? `  samlProvider: "${samlProvider}",\n` : "";

  // ── Users block
  const userParams = {
    authType,
    authPageLayout,
    actionUrl,
    effectiveIsApi,
    hasPassword,
    isOtp,
    tokenType,
    includeAdminUser,
    baseUrl,
  };

  let usersBlock: string;
  let usersFile: string | null = null;

  if (configStyle === "flat") {
    usersBlock = _inlineUsersBlock(userParams);
    notes.push(
      "[Config style] : FLAT — users are defined inline in base.config.ts.",
    );
    notes.push("   Ideal for: single-user setups, quick starts, simple apps.");
  } else {
    usersBlock = `  // Users are loaded automatically from users.json.\n  users: [] as IUser[],\n`;
    usersFile = _generateUsersJson(userParams);
    notes.push(
      "[Config style] : USERS-FILE — users are defined in users.json.",
    );
    notes.push("   Ideal for: multi-role apps, different auth flows per user.");
    if (includeAdminUser) {
      notes.push("   Includes: standard user + admin user examples.");
    }
  }

  const oidcPatternsBlock = authType === "oidc" ? _oidcPatternsBlock() : "";
  const localStorageOptionsBlock = _localStorageOptions(
    input.tokenStorageConfig,
  );

  // ── Assemble ───
  const configFile = _assembleConfigFile({
    authType,
    effectiveIsApi,
    authPageLayout,
    baseUrl,
    actionUrl,
    oauthSection,
    oidcSection,
    samlSection,
    otpSection,
    apiSection,
    usersBlock,
    localStorageOptionsBlock,
    oidcPatternsBlock,
    configStyle,
    resolvedOtpStrategy,
  });

  // ── Notes
  notes.push(`\n[OK] Auth type      : ${authType}`);
  notes.push(
    `[OK] Mode           : ${effectiveIsApi ? "API (direct HTTP)" : "Browser (Playwright)"}`,
  );
  notes.push(`[OK] Layout         : ${authPageLayout}`);
  if (isOtp) {
    notes.push(`[OK] OTP render     : ${otpMode}`);
    notes.push(`[OK] OTP strategy   : ${resolvedOtpStrategy}`);
    if (resolvedOtpStrategy === "hidden-input") {
      notes.push(
        '   ↳ hidden-input: pressSequentially() on <input autocomplete="one-time-code">.',
        "   ↳ Confirm in DevTools: look for one hidden input behind the visual boxes.",
      );
    }
  }
  notes.push(`[OK] Config file    : base.config.ts`);
  if (usersFile) notes.push(`[OK] Users file     : users.json`);

  notes.push(`\nNext steps:`);
  notes.push(`  1. Set BASE_SERVER_URL and actionUrl to your actual app URLs`);
  if (hasPassword)
    notes.push(
      `  2. Replace TEST_USER_PASSWORD in .env with real test credentials`,
    );
  if (isOtp) {
    notes.push(
      `  3. Configure otpConfig.requestConfig to point at your OTP endpoint`,
    );
    if (resolvedOtpStrategy === "hidden-input") {
      notes.push(
        `     Also: verify the hidden-input selector matches your app's DOM`,
      );
      notes.push(`     (default: input[autocomplete="one-time-code"])`);
    }
  }
  if (effectiveIsApi)
    notes.push(
      `  ${isOtp ? "4" : "3"}. Set apiConfig.path to your login endpoint`,
    );
  notes.push(`  Run: npx playwright test --project=setup`);

  return { configFile, usersFile, notes };
}

// ─── Config file assembler

function _assembleConfigFile(p: {
  authType: string;
  effectiveIsApi: boolean;
  authPageLayout: AuthPageLayout;
  baseUrl: string;
  actionUrl: string;
  oauthSection: string;
  oidcSection: string;
  samlSection: string;
  otpSection: string | null;
  apiSection: string | null;
  usersBlock: string;
  localStorageOptionsBlock: string;
  oidcPatternsBlock: string;
  configStyle: string;
  resolvedOtpStrategy: OTPStrategy;
}): string {
  const {
    authType,
    effectiveIsApi,
    authPageLayout,
    baseUrl,
    actionUrl,
    oauthSection,
    oidcSection,
    samlSection,
    otpSection,
    apiSection,
    usersBlock,
    localStorageOptionsBlock,
    oidcPatternsBlock,
    configStyle,
    resolvedOtpStrategy,
  } = p;

  // Build the selectors comment block for the OTP strategy in use
  const otpSelectorComment = otpSection
    ? `    // OTP field selectors — depends on otpConfig.strategy:
    //   "single-input"  => matches the single text input
    //   "hidden-input"  => MUST match input[autocomplete="one-time-code"]
    //                     (leave empty to use the built-in default)
    //   "multi-input"   => matches each digit input (nth(i) is applied)
    otpSingleField:  "",   // strategy: single-input  | default: input[name="otp"]
    otpHiddenField:  "",   // strategy: hidden-input  | default: input[autocomplete="one-time-code"]
    otpMultiFields:  "",   // strategy: multi-input   | default: [data-testid="otp-digit"]`
    : `    otpSingleField:  "",   // default: input[name="otp"]
    otpMultiFields:  "",   // default: [data-testid="otp-digit"]`;

  return `import {
  AuthMode,
  AuthOverrideSelectors,
  AuthType,
  IAuthConfig,
  IUser,
  OAuthProvider,
  OIDCProvider,
  SAMLProvider,
} from "qa-pwmaf";

import * as dotenv from "dotenv";
dotenv.config();

// ──────────────────
// BASE CONFIG
// Generated by: npx pwmaf init
// Auth type:    ${authType}
// Mode:         ${effectiveIsApi ? "API (direct HTTP calls)" : "Browser (Playwright navigates the login page)"}
// Layout:       ${authPageLayout}
// Config style: ${configStyle === "flat" ? "Flat (users defined inline)" : "Users-file (users.json)"}
// ──────────────────

export const BASE_CONFIG: IAuthConfig = {

  // ── Core ───────

  // How browser contexts are managed across tests.
  // "single" => one shared context reused (faster, less isolated)
  // "multi"  => fresh context per test (slower, fully isolated)
  mode: (process.env.AUTH_MODE ?? "multi") as AuthMode,

  // Authentication strategy. Users in users.json inherit this unless overridden.
  authType: (process.env.AUTH_TYPE ?? "${authType}") as AuthType,
${oauthSection}${oidcSection}${samlSection}
  // Where session files are saved after login. One .json file per user.
  storageStatePath: ".auth",

  // Set true to force fresh logins on every run (useful for short-lived tokens).
  deleteAuthStorageOnTestRun: false,

  // ── URLs ───────

  // Base URL of the application. No trailing slash.
  BASE_SERVER_URL: process.env.BASE_URL ?? "${baseUrl}",

  // Login page URL (browser flows) or API base URL (API flows).
  // This is also set on each user object — per-user actionUrl takes precedence.
  actionUrl: process.env.ACTION_URL ?? "${actionUrl}",

  // URL glob Playwright waits for after a successful login.
  successUrl: "**/dashboard**",

  // ── Browser Login Layout 
  // How the login form is structured. Inherited by all users unless overridden.
  //
  // "single-page"          => email + password visible together on page load
  // "progressive-reveal"   => email submitted first, password field reveals after
  // "redirect-to-new-page" => submitting email navigates to a new password page
  authPageLayout: "${authPageLayout}",

  // ── Users ──────
${usersBlock}
${
  otpSection
    ? `  // ── OTP Configuration 
  // Required for authType "email-otp" or "email-password-otp".
  // mode (visual)   => what the UI looks like
  // strategy (fill) => how Playwright actually interacts with the input
${otpSection}`
    : ""
}
  // ── API Auth ───
  // true  => skip browser; POST credentials directly to your login API
  // false => use browser (required for oauth, oidc, saml)
  isApi: ${effectiveIsApi},

${
  apiSection
    ? apiSection
    : `  // apiConfig is only needed when isApi: true.
  // apiConfig: { path: "/auth/login", tokenType: "cookie" },
`
}
  // ── Parallelism 
  // true  => login users sequentially with a 500ms delay between each
  //         (use if your auth endpoint rate-limits concurrent requests)
  // false => all users authenticated in parallel via Promise.all (default)
  rateLimited: false,

  // ── Re-auth ────
  // true  => expired sessions are automatically re-authenticated
  // false => use stale session as-is (tests may see 401s after token expiry)
  allowReauth: true,

  // ── Selectors ──
  // Override the selectors the framework uses on your login page.
  // Leave a field as "" to use the built-in resilient fallback selector.
  selectors: {
    emailOrUsernameField: '',   // default: input[type="email"], input[name="email"]
    passwordField:        '',   // default: input[type="password"]
    passwordSubmitButton: '', // default: input[type="password-submit"]
${otpSelectorComment}
    ssoButton:            '',   // default: button[data-provider], [data-testid="sso-btn"]
  } satisfies AuthOverrideSelectors,
${oidcPatternsBlock}
  strategyLoggerActive: false,
${localStorageOptionsBlock}
  };

`;
}

// ─── OTP config block

function _otpConfigBlock(
  source: OTPSource,
  mode: OTPMode,
  strategy: OTPStrategy,
  baseUrl: string,
): string {
  const strategyDocs: Record<OTPStrategy, string> = {
    "single-input": `
    //   authPage.fillOTPSingle(otp)
    //   => page.locator('input').first().fill(code)
    //   For: a single <input> that accepts the full OTP string.`,

    "hidden-input": `
    //   authPage.fillOTPHidden(otp)
    //   => page.locator('input[autocomplete="one-time-code"]').pressSequentially(code)
    //   For: UIs that render segmented visual boxes but are backed by ONE
    //        hidden <input autocomplete="one-time-code"> in the DOM.
    //   How to confirm: open DevTools => Elements while focused on the OTP UI.
    //        If you see 6 box-divs but only 1 <input>, this is your strategy.
    //   Common in: Auth0, AWS Cognito, many custom OTP component libraries.`,

    "multi-input": `
    //   authPage.fillOTPMulti(otp, fieldCount)
    //   => inputs.nth(i).fill(code[i]) for each digit
    //   For: UIs where each digit box IS a genuine separate <input> element.
    //   How to confirm: DevTools shows ${mode === "segmented" ? "fieldCount" : "6"} real <input> siblings,
    //        one per box.
    //   Common in: Okta Verify, Twilio Verify, TOTP widgets.`,
  };

  return `  otpConfig: {
    // ── Visual appearance (mode) ──────────────────────────────────────────────
    // "single-input" => one text box the user types the full code into
    // "segmented"    => individual boxes displayed per digit (6 by default)
    mode: "${mode}",
    ${
      mode === "segmented"
        ? `\n    // Number of digit boxes shown in the segmented UI.
    fieldCount: 6,\n    `
        : ""
    }
    // ── Interaction strategy ──────────────────────────────────────────────────
    // Tells Playwright HOW to fill the OTP field. Choose based on the DOM, not
    // on how the UI looks — visually segmented ≠ technically multi-input.
    //
    // "single-input"  => one real <input> for the whole code${strategyDocs["single-input"]}
    //
    // "hidden-input"  => segmented UI backed by one hidden <input>${strategyDocs["hidden-input"]}
    //
    // "multi-input"   => each box is a genuine separate <input>${strategyDocs["multi-input"]}
    strategy: "${strategy}",

    // ── Submission ─
    // true  => OTP form submits automatically when all digits are filled
    //         (no button click needed — saves one interaction step)
    // false => framework clicks the OTP submit button after filling
    autoSubmit: false,

    // URL glob for the OTP page (only if authPageLayout is "redirect-to-new-page").
    otpPageUrl: "**/otp**",

    // ── OTP Source ─
    // "env"           => OTP read from process.env[envKey]
    // "api-intercept" => OTP captured from an intercepted outbound API response
    // "api-request"   => OTP fetched by calling a dedicated test endpoint
    source: "${source}",
${_otpSourceBlock(source, baseUrl)}
  },\n`;
}

function _otpSourceBlock(source: OTPSource, baseUrl: string): string {
  switch (source) {
    case "env":
      return `
    // ── source: "env" ─────────────────────────────────────────────────────────
    // Name of the environment variable that holds the static OTP.
    // Useful for fixed test OTPs in local dev or seed-based CI environments.
    envKey: "TEST_OTP",
    // Export before running tests: TEST_OTP=123456 npx playwright test
`;

    case "api-intercept":
      return `
    // ── source: "api-intercept" ───────────────────────────────────────────────
    // Playwright route glob matching the API call your app makes to send the OTP.
    // The framework intercepts this call and reads the OTP from the response body.
    // Adjust the pattern to match your actual OTP delivery endpoint.
    interceptPattern: "**/api/auth/otp/send**",
`;

    case "api-request":
      return `
    // ── source: "api-request" ─────────────────────────────────────────────────
    // Fetch the OTP by calling a test-only endpoint after the login form triggers.
    requestConfig: {
      baseUrl: process.env.BASE_URL ?? "${baseUrl}",
      // {username} is replaced with the user's email/username at runtime.
      // {userId} is also available if your endpoint keys on user ID instead.
      path:         "/auth/get-otp/{username}",
      method:       "GET",
      // headers:   { Authorization: \`Bearer \${process.env.TEST_API_KEY}\` },
      // Dot-notation path to the OTP in the JSON response body.
      // e.g. if response is { data: { otp: "123456" } } use "data.otp"
      responsePath: "data.otp",
    },

    // Optional: verify the OTP via a direct API call instead of browser form submission.
    // When present, the framework calls this endpoint after fetching the OTP,
    // receives the access token, and applies it to the browser context.
    // Remove this block to let the framework submit the OTP via the browser form instead.
    verifyConfig: {
      baseUrl: process.env.BASE_URL ?? "${baseUrl}",
      path:            "/auth/verify-otp/{username}",
      method:          "POST",
      body:            { email: "{username}", otp: "{otp}" },
      // Dot-notation path to the access token in the verify response.
      accessTokenPath: "data.accessToken",
    },
`;
  }
}

// ─── API config block ─────────────────────────────────────────────────────────

function _apiConfigBlock(tokenType: TokenType): string {
  const tokenDocs: Record<TokenType, string> = {
    cookie: `
    // Cookie auth: the server sets a session cookie in the Set-Cookie header.
    // No extra extraction needed — Playwright's request context carries it automatically.
    tokenType: "cookie",`,

    bearer: `
    // Bearer auth: extract the token from the login response and attach it as
    // "Authorization: Bearer <token>" on all subsequent requests.
    tokenType:  "bearer",
    // Dot-notation path to the token in the login response body.
    // e.g. if response is { data: { accessToken: "abc123" } } => "data.accessToken"
    tokenPath:  "data.accessToken",`,

    "custom-header": `
    // Custom header auth: extract token and send it as a named request header.
    tokenType:       "custom-header",
    tokenPath:       "token",          // dot-notation path in response body
    tokenHeaderName: "X-Auth-Token",   // exact header name your API expects`,
  };

  return `  apiConfig: {
    // Path to your login endpoint (relative to actionUrl).
    path: "/auth/login",

    // Rename framework field names to what your API expects in the request body.
    fieldMap: {
      username: "email",    // sends { "email": "user@test.com" }
      password: "password", // sends { "password": "..." }
    },

    // Extra fields merged into the login request body.
    // additionalFields: { grant_type: "password", clientId: "my-app" },

    // How the auth token is applied after a successful login:
${tokenDocs[tokenType]}
  },\n`;
}

function _oidcPatternsBlock(): string {
  return `
  // ── OIDC Provider URL Patterns ────────────────────────────────────────────
  // Playwright route globs that identify each provider's authorization URL.
  // The framework intercepts navigation to these URLs and redirects to the
  // mock callback instead.  Update if your provider uses a non-standard format.
  OIDCProviderPatterns: {
    okta:       "**/*.okta.com/oauth2/**/authorize**",
    auth0:      "**/*.auth0.com/authorize**",
    keycloak:   "**/auth/realms/**/protocol/openid-connect/auth**",
    "azure-ad": "**/login.microsoftonline.com/**/oauth2/v2.0/authorize**",
    cognito:    "**/*.auth.*.amazoncognito.com/oauth2/authorize**",
    ping:       "**/*.pingidentity.com/as/authorization**",
  },\n`;
}

function _localStorageOptions(
  tokenStorage?: GeneratorInput["tokenStorageConfig"],
): string {
  if (!tokenStorage) {
    return `
  // ── Token Storage (optional) ───────────────────────────────────────────────
  // Uncomment and configure if your app stores the auth token in
  // localStorage or sessionStorage instead of cookies.
  //
  // tokenStorage: {
  //   storageType:  "localStorage",   // or "sessionStorage"
  //   storageKey:   "app_user",       // key used in storage
  //   tokenPath:    "accessToken",    // dot-notation into the stored JSON value, Not needed for sessionStorage
  //   origin:       "https://app.example.com",
  //   headerName:   "Authorization",  // defaults to "Authorization"
  //   attachBearer: true,             // prepends "Bearer " when true
  // },
`;
  }

  return `
  // ── Token Storage ──────────────────────────────────────────────────────────
  tokenStorage: {
    storageType:  "${tokenStorage.storageType}",
    storageKey:   "${tokenStorage.storageKey}",${
      tokenStorage.tokenPath
        ? `\n    tokenPath:    "${tokenStorage.tokenPath}",`
        : ""
    }${
      tokenStorage.origin ? `\n    origin:       "${tokenStorage.origin}",` : ""
    }${
      tokenStorage.headerName
        ? `\n    headerName:   "${tokenStorage.headerName}",`
        : ""
    }${
      tokenStorage.attachBearer !== undefined
        ? `\n    attachBearer: ${tokenStorage.attachBearer},`
        : ""
    }
  },
`;
}

// ─── Inline users block (flat config style) ───────────────────────────────────

interface UserBlockParams {
  authType: string;
  authPageLayout: AuthPageLayout;
  actionUrl: string;
  effectiveIsApi: boolean;
  hasPassword: boolean;
  isOtp: boolean;
  tokenType: TokenType;
  includeAdminUser: boolean;
  baseUrl: string;
}

function _inlineUsersBlock(p: UserBlockParams): string {
  const {
    authType,
    authPageLayout,
    actionUrl,
    effectiveIsApi,
    hasPassword,
    tokenType,
  } = p;

  const passwordLine = hasPassword
    ? `\n      // Never hardcode passwords — read from env vars.
      password: process.env.TEST_USER_PASSWORD ?? "password123",`
    : "";

  const apiOverride = effectiveIsApi
    ? `\n      isApi: true,
      apiConfig: {
        path: "/auth/login",
        tokenType: "${tokenType}",${
          tokenType !== "cookie"
            ? `\n        tokenPath: "data.accessToken",`
            : ""
        }
      },`
    : "";

  return `  users: [
    {
      // ── Test user ─────────────────────────────────────────────────────────
      // authType, authPageLayout and actionUrl are set explicitly here so that
      // changing the root config values above never silently affects this user.
      username:       process.env.TEST_USER_EMAIL ?? "user@test.com",${passwordLine}
      role:           "user",
      authType:       "${authType}",
      authPageLayout: "${authPageLayout}",
      actionUrl:      process.env.ACTION_URL ?? "${actionUrl}",${apiOverride}
    },
  ] as IUser[],\n`;
}

// ─── users.json generator ─────────────────────────────────────────────────────

function _generateUsersJson(p: UserBlockParams): string {
  const {
    authType,
    authPageLayout,
    actionUrl,
    effectiveIsApi,
    hasPassword,
    tokenType,
    includeAdminUser,
  } = p;

  const pwdUser = hasPassword ? `,\n    "password": "password123"` : "";
  const pwdAdmin = hasPassword ? `,\n    "password": "admin123"` : "";

  const apiFields = effectiveIsApi
    ? `,\n    "isApi": true,
    "apiConfig": {
      "path": "/auth/login",
      "tokenType": "${tokenType}"${
        tokenType !== "cookie" ? `,\n      "tokenPath": "data.accessToken"` : ""
      }
    }`
    : "";

  // Every user object explicitly declares authType, authPageLayout, actionUrl.
  // This makes each row self-documenting and independent of root config defaults.
  const standardUser = `  {
    "username": "user@test.com"${pwdUser},
    "role": "user",
    "authType": "${authType}",
    "authPageLayout": "${authPageLayout}",
    "actionUrl": "${actionUrl}"${apiFields}
  }`;

  const adminUser = `  {
    "username": "admin@test.com"${pwdAdmin},
    "role": "admin",
    "authType": "${authType}",
    "authPageLayout": "${authPageLayout}",
    "actionUrl": "${actionUrl}"${apiFields}
  }`;

  // Mixed-auth example: one user deviates from the base authType
  const mixedAuthExample =
    authType === "email-password"
      ? `  {
    "username": "sso-user@test.com",
    "role": "user",
    "authType": "oauth",
    "oauthProvider": "google",
    "authPageLayout": "single-page",
    "actionUrl": "${actionUrl}"
    // This user logs in via Google OAuth even though BASE_CONFIG uses email-password.
    // Per-user authType, authPageLayout, and actionUrl overrides are fully supported.
  }`
      : null;

  const rows = [standardUser];
  if (includeAdminUser) rows.push(adminUser);
  if (mixedAuthExample) rows.push(mixedAuthExample);

  return `[
${rows.join(",\n")}
]
`;
}

// ─── Preset configurations ────────────────────────────────────────────────────
//
//  Every preset is a complete GeneratorInput that passes validateConfig() with
//  zero errors.  Use as-is or as a starting point to customise.
//
//  OTP strategy conventions used in presets:
//    • otpStrategy omitted  => defaults to "multi-input" (real separate inputs)
//    • otpStrategy: "hidden-input" => explicitly for hidden-input-behind-boxes apps

export const PRESETS: Record<string, GeneratorInput> = {
  // ── Email + Password ────────────────────────────────────────────────────────

  "browser-email-password-flat": {
    authType: "email-password",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-progressive-flat": {
    authType: "email-password",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "progressive-reveal",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-users-file": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  "browser-email-password-progressive-users-file": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "progressive-reveal",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  // ── Email OTP ────

  "browser-email-otp-single-input": {
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "single-input",
    otpStrategy: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-otp-segmented-real-inputs": {
    // Each digit box is a genuine separate <input> element.
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "multi-input", // ← real nth(i) inputs
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-otp-segmented-hidden-input": {
    // Segmented visual but backed by one hidden <input autocomplete="one-time-code">.
    // How to detect: inspect the OTP UI in DevTools — only one <input> exists.
    // Common in: Auth0, Cognito, many custom OTP component libraries.
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input", // ← pressSequentially on hidden input
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-otp-redirect-hidden-input": {
    // Redirect-to-new-page OTP page with a hidden-input-backed segmented UI.
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "redirect-to-new-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-otp-env-source": {
    // OTP read from environment variable — no API fetch needed.
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "env",
    otpMode: "single-input",
    otpStrategy: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-otp-intercept-source": {
    // OTP captured from the outbound send-OTP API call via Playwright route interception.
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-intercept",
    otpMode: "single-input",
    otpStrategy: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-otp-users-file": {
    authType: "email-otp",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "multi-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  // ── Email + Password + OTP (2FA) ────────────────────────────────────────────

  "browser-email-password-otp-single": {
    authType: "email-password-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "single-input",
    otpStrategy: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-otp-segmented-real": {
    authType: "email-password-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "multi-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-otp-segmented-hidden": {
    // Password + OTP where the 2FA screen uses a hidden-input-backed segmented UI.
    authType: "email-password-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-otp-progressive-hidden": {
    // Progressive-reveal password step followed by hidden-input OTP screen.
    authType: "email-password-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "progressive-reveal",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-otp-redirect-hidden": {
    // Redirect-to-new-page 2FA page with hidden-input segmented OTP.
    authType: "email-password-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "redirect-to-new-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-otp-users-file": {
    authType: "email-password-otp",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  // ── OAuth / OIDC / SAML ─────────────────────────────────────────────────────

  "browser-oauth-google": {
    authType: "oauth",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oauthProvider: "google",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-oauth-github": {
    authType: "oauth",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oauthProvider: "github",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-oauth-microsoft": {
    authType: "oauth",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oauthProvider: "microsoft",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-oidc-okta": {
    authType: "oidc",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oidcProvider: "okta",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-oidc-auth0": {
    authType: "oidc",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oidcProvider: "auth0",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-oidc-azure-ad": {
    authType: "oidc",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oidcProvider: "azure-ad",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-saml-okta": {
    authType: "saml",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    samlProvider: "okta",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-saml-azure": {
    authType: "saml",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    samlProvider: "azure",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  // ── API flows

  "api-email-password-cookie": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "cookie",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  "api-email-password-bearer": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "bearer",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  "api-email-password-custom-header": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "custom-header",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  "api-email-otp-bearer": {
    authType: "email-otp",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "bearer",
    otpSource: "api-request",
    otpMode: "single-input",
    otpStrategy: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  "api-email-password-otp-bearer": {
    authType: "email-password-otp",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "bearer",
    otpSource: "api-request",
    otpMode: "single-input",
    otpStrategy: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  // ── Multi-role / users-file ─────────────────────────────────────────────────

  "multi-role-email-password": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  "multi-role-email-otp-hidden-input": {
    authType: "email-otp",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  "multi-role-email-password-otp-hidden-input": {
    authType: "email-password-otp",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "hidden-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  "browser-email-password-localstorage-token": {
    authType: "email-password",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    tokenStorageConfig: {
      storageType: "localStorage",
      storageKey: "app_user",
      tokenPath: "accessToken",
      origin: "http://localhost:3000",
      attachBearer: true,
    },
  },

  "browser-email-password-sessionstorage-token": {
    authType: "email-password",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    tokenStorageConfig: {
      storageType: "sessionStorage",
      storageKey: "session_token",
      origin: "http://localhost:3000",
      attachBearer: true,
    },
  },
};

// ─── CLI output helper

export function printGeneratedConfig(output: GeneratorOutput): void {
  const rule = "─".repeat(72);

  console.log("\n" + rule);
  console.log("   base.config.ts");
  console.log(rule);
  console.log(output.configFile);

  if (output.usersFile) {
    console.log("\n" + rule);
    console.log("   users.json");
    console.log(rule);
    console.log(output.usersFile);
  }

  console.log("\n" + rule);
  console.log("  [NOTES]: ");
  console.log(rule);
  output.notes.forEach((n) => console.log(n));
  console.log(rule + "\n");
}

// ─── Preset lookup helper

/** Returns all preset keys, optionally filtered by authType. */
export function listPresets(filterAuthType?: AuthType): string[] {
  const keys = Object.keys(PRESETS);
  if (!filterAuthType) return keys;
  return keys.filter((k) => PRESETS[k].authType === filterAuthType);
}

/** Generate config directly from a preset name. */
export function generateFromPreset(presetName: string): GeneratorOutput {
  const input = PRESETS[presetName];
  if (!input) {
    const available = Object.keys(PRESETS).join(", ");
    throw new Error(
      `Unknown preset "${presetName}".\nAvailable presets:\n  ${available}`,
    );
  }
  return generateConfig(input);
}
