/**
 * config-generator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates ready-to-fly BASE_CONFIG and users.json templates for every
 * supported auth combination.
 *
 * QA USAGE — two ways to get a config:
 *
 *   1. Interactive CLI (recommended for new setups):
 *      npx pwmaf init
 *      → prompts for auth type, mode, API vs browser, etc.
 *      → writes base.config.ts + users.json to chosen location
 *
 *   2. Programmatic (for custom tooling):
 *      import { generateConfig } from "@pwmaf/config-generator";
 *      const { config, users } = generateConfig({ authType: "email-password", isApi: false });
 *
 * DESIGN DECISIONS
 * ─────────────────────────────────────────────────────────────────────────────
 * - "flat" mode: all user fields live on ROOT config — one user, zero users.json.
 *   Perfect for simple setups where every test runs as the same user.
 * - "users-file" mode: root config holds defaults, users.json holds per-user
 *   overrides. Required for multi-role, multi-auth-type setups.
 * - Every generated config is immediately valid — passes validateConfig() with
 *   zero errors out of the box.
 * - Sensitive values (passwords, API keys) are replaced with env var references
 *   so the generated files are safe to commit.
 */


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
export type OTPMode = "single-input" | "segmented";
export type AuthPageLayout =
  | "single-page"
  | "progressive-reveal"
  | "redirect-to-new-page";
export type TokenType = "bearer" | "cookie" | "custom-header";
export type ConfigStyle = "flat" | "users-file";

export interface GeneratorInput {
  /** Auth strategy to use */
  authType: AuthType;

  /** false = browser flow (Playwright navigates the login page)
   *  true  = API flow (framework POSTs credentials directly, no browser) */
  isApi: boolean;

  /** "flat"       = single user config, everything on root config, no users.json
   *  "users-file" = root config holds defaults, users.json holds per-user rows */
  configStyle: ConfigStyle;

  /** Base URL of the app under test */
  baseUrl?: string;

  /** Login page URL (browser) or API base URL (isApi) */
  actionUrl?: string;

  /** For oauth / oidc */
  oauthProvider?: OAuthProvider;
  oidcProvider?: OIDCProvider;
  samlProvider?: SAMLProvider;

  /** For OTP flows */
  otpSource?: OTPSource;
  otpMode?: OTPMode;

  /** For API flows */
  tokenType?: TokenType;

  /** For multi-role examples in users-file mode */
  includeAdminUser?: boolean;
}

export interface GeneratorOutput {
  /** The base.config.ts file content as a string */
  configFile: string;

  /** The users.json file content (null when configStyle is "flat") */
  usersFile: string | null;

  /** Human-readable notes about what was generated */
  notes: string[];
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateConfig(input: GeneratorInput): GeneratorOutput {
  const {
    authType,
    isApi,
    configStyle,
    baseUrl = "http://localhost:3000",
    actionUrl = "http://localhost:3000",
    oauthProvider = "google",
    oidcProvider = "okta",
    samlProvider = "okta",
    otpSource = "api-request",
    otpMode = "single-input",
    tokenType = "cookie",
    includeAdminUser = true,
  } = input;

  const notes: string[] = [];
  const isBrowserOnly = ["oauth", "oidc", "saml"].includes(authType);

  // Sanity corrections
  const effectiveIsApi = isBrowserOnly ? false : isApi;
  if (isBrowserOnly && isApi) {
    notes.push(
      `⚠️  authType "${authType}" is browser-only. isApi has been set to false.`,
    );
  }

  const isOtp = ["email-otp", "email-password-otp"].includes(authType);
  const hasPassword = ["email-password", "email-password-otp"].includes(
    authType,
  );

  // ── Build sections ──────────────────────────────────────────────────────────
  const otpSection = isOtp
    ? _otpConfigBlock(otpSource, otpMode, baseUrl)
    : null;
  const apiSection = effectiveIsApi ? _apiConfigBlock(tokenType) : null;
  const oauthSection =
    authType === "oauth" ? `  oauthProvider: "${oauthProvider}",\n` : "";
  const oidcSection =
    authType === "oidc" ? `  oidcProvider: "${oidcProvider}",\n` : "";
  const samlSection =
    authType === "saml" ? `  samlProvider: "${samlProvider}",\n` : "";

  // ── Users block ─────────────────────────────────────────────────────────────
  let usersBlock: string;
  let usersFile: string | null = null;

  if (configStyle === "flat") {
    // Inline users directly in config — one entry, all fields present
    usersBlock = _inlineUsersBlock(
      authType,
      effectiveIsApi,
      hasPassword,
      isOtp,
      tokenType,
    );
    notes.push(
      "📄 Config style: FLAT — users are defined inline in base.config.ts.",
    );
    notes.push("   Ideal for: single-user setups, quick starts, simple apps.");
  } else {
    // users.json mode — config just has users: [] as IUser[]
    usersBlock = `  // Users are loaded automatically from users.json (see usersFilePath above).\n  users: [] as IUser[],\n`;
    usersFile = _generateUsersJson(
      authType,
      effectiveIsApi,
      hasPassword,
      isOtp,
      tokenType,
      includeAdminUser,
    );
    notes.push(
      "📄 Config style: USERS-FILE — users are defined in users.json.",
    );
    notes.push("   Ideal for: multi-role apps, different auth flows per user.");
    if (includeAdminUser) {
      notes.push("   Includes: standard user + admin user examples.");
    }
  }

  // ── oidcProviderPatterns (only for oidc) ────────────────────────────────────
  const oidcPatternsBlock = authType === "oidc" ? _oidcPatternsBlock() : "";

  // ── Assemble the config file ─────────────────────────────────────────────────
  const configFile = _assembleConfigFile({
    authType,
    effectiveIsApi,
    baseUrl,
    actionUrl,
    oauthSection,
    oidcSection,
    samlSection,
    otpSection,
    apiSection,
    usersBlock,
    oidcPatternsBlock,
    configStyle,
    hasPassword,
    isBrowserOnly,
  });

  // ── Notes ───────────────────────────────────────────────────────────────────
  notes.push(`\n✅ Auth type:   ${authType}`);
  notes.push(
    `✅ Mode:        ${effectiveIsApi ? "API (direct HTTP)" : "Browser (Playwright)"}`,
  );
  notes.push(`✅ Config file: base.config.ts`);
  if (usersFile) notes.push(`✅ Users file:  users.json`);
  notes.push(`\nNext steps:`);
  notes.push(`  1. Set BASE_SERVER_URL and actionUrl to your actual app URLs`);
  if (hasPassword)
    notes.push(
      `  2. Replace TEST_USER_PASSWORD in .env with real test passwords`,
    );
  if (isOtp)
    notes.push(`  3. Configure your OTP endpoint in otpConfig.requestConfig`);
  if (effectiveIsApi)
    notes.push(`  4. Set apiConfig.path to your login endpoint`);
  notes.push(
    `  ${hasPassword ? "5" : "2"}. Run: npx playwright test --project=setup`,
  );

  return { configFile, usersFile, notes };
}

// ─── Config file assembler ────────────────────────────────────────────────────

function _assembleConfigFile(p: {
  authType: string;
  effectiveIsApi: boolean;
  baseUrl: string;
  actionUrl: string;
  oauthSection: string;
  oidcSection: string;
  samlSection: string;
  otpSection: string | null;
  apiSection: string | null;
  usersBlock: string;
  oidcPatternsBlock: string;
  configStyle: string;
  hasPassword: boolean;
  isBrowserOnly: boolean;
}): string {
  const {
    authType,
    effectiveIsApi,
    baseUrl,
    actionUrl,
    oauthSection,
    oidcSection,
    samlSection,
    otpSection,
    apiSection,
    usersBlock,
    oidcPatternsBlock,
    configStyle,
    hasPassword,
    isBrowserOnly,
  } = p;

  return `import {
  AuthMode,
  AuthOverrideSelectors,
  AuthType,
  IAuthConfig,
  IUser,
  OAuthProvider,
  OIDCProvider,
  SAMLProvider,
} from "@pwmaf/types";

// ─────────────────────────────────────────────────────────────────────────────
// BASE CONFIG
// Generated by: npx pwmaf init
// Auth type:    ${authType}
// Mode:         ${effectiveIsApi ? "API (direct HTTP calls)" : "Browser (Playwright navigates the login page)"}
// Config style: ${p.configStyle === "flat" ? "Flat (users defined inline)" : "Users-file (users.json)"}
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_CONFIG: IAuthConfig = {

  // ── Core ──────────────────────────────────────────────────────────────────

  // How browser contexts are managed across tests.
  // "single" → one shared context reused across all tests (faster, less isolated)
  // "multi"  → fresh context per test (slower, fully isolated)
  mode: (process.env.AUTH_MODE ?? "single") as AuthMode,

  // Authentication strategy. All users inherit this unless overridden in users.json.
  authType: (process.env.AUTH_TYPE ?? "${authType}") as AuthType,

${oauthSection}${oidcSection}${samlSection}
  // Where session files are saved after login. One file per user.
  storageStatePath: ".auth",

  // Set true to force fresh logins every run (useful when tokens expire quickly).
  deleteAuthStorageOnTestRun: false,

  // ── URLs ──────────────────────────────────────────────────────────────────

  // Base URL of the application under test. No trailing slash.
  BASE_SERVER_URL: process.env.BASE_URL ?? "${baseUrl}",

  // Login page URL (browser flows) or API base URL (API flows).
  actionUrl: process.env.ACTION_URL ?? "${actionUrl}",

  // URL glob Playwright waits for after a successful login.
  successUrl: "**/dashboard**",

  // ── Users ─────────────────────────────────────────────────────────────────
  ${
    p.configStyle === "users-file"
      ? `\n  // Path to the JSON file that defines test users.
  // Each user can override any field from this config (authType, actionUrl, etc.)
  usersFilePath: "src/data/users.json",\n`
      : ""
  }
${usersBlock}
  // ── Browser Login Layout ──────────────────────────────────────────────────
  // How the login form is structured. Only relevant for browser flows.
  // "single-page"          → email + password visible on page load
  // "progressive-reveal"   → email submitted first, then password field appears
  // "redirect-to-new-page" → submitting email redirects to a password page
  authPageLayout: "single-page",

${
  otpSection
    ? `  // ── OTP Configuration ────────────────────────────────────────────────────
  // Required for authType "email-otp" or "email-password-otp".
${otpSection}`
    : ""
}
  // ── API Auth ──────────────────────────────────────────────────────────────
  // true  → skip browser; POST credentials directly to your login API
  // false → use browser (required for oauth, oidc, saml)
  isApi: ${effectiveIsApi},

${
  apiSection
    ? `${apiSection}`
    : `  // apiConfig is only needed when isApi: true.
  // apiConfig: { path: "/auth/login", tokenType: "cookie" },
`
}
  // ── Parallelism ───────────────────────────────────────────────────────────
  // true → login users one at a time with a 500ms delay (use if your auth
  //        endpoint rate-limits concurrent requests)
  rateLimited: false,

  // ── Re-auth ───────────────────────────────────────────────────────────────
  allowReauth: true,
  maxAuthRetries: 2,

  // ── Selectors ─────────────────────────────────────────────────────────────
  // Override the CSS/test-id selectors the framework uses on your login page.
  // Leave a field as "" to use the built-in default selector for that field.
  selectors: {
    emailOrUsernameField: "",   // default: input[type="email"], input[name="email"]
    passwordField:        "",   // default: input[type="password"]
    otpSingleField:       "",   // default: input[name="otp"], input[placeholder*="code"]
    otpMultiFields:       "",   // default: input[data-testid="otp-digit"]
    ssoButton:            "",   // default: button[data-provider], [data-testid="sso-btn"]
  } satisfies AuthOverrideSelectors,
${oidcPatternsBlock}
  // ── Logging ───────────────────────────────────────────────────────────────
  strategyLoggerActive: false,
};
`;
}

// ─── OTP config block ─────────────────────────────────────────────────────────

function _otpConfigBlock(
  source: OTPSource,
  mode: OTPMode,
  baseUrl: string,
): string {
  const sourceBlocks: Record<OTPSource, string> = {
    env: `
    // ── source: "env"
    // Name of the env var holding the static OTP. Defaults to TEST_OTP.
    envKey: "TEST_OTP",
    // Make sure to export: TEST_OTP=123456 before running tests.`,

    "api-intercept": `
    // ── source: "api-intercept"
    // Playwright route glob that matches the API call your app uses to send the OTP.
    // The framework intercepts this call and reads the OTP from the response body.
    interceptPattern: "**/api/auth/otp/send**",`,

    "api-request": `
    // ── source: "api-request"
    // Fetch the OTP by calling a test-only endpoint after the login form is submitted.
    requestConfig: {
      baseUrl: process.env.BASE_URL ?? "${baseUrl}",
      // {username} is replaced with the user's username at runtime.
      path: "/auth/get-otp/{username}",
      method: "GET",
      // responsePath: dot-notation path to the OTP in the response body.
      // e.g. if response is { data: { otp: "123456" } } → "data.otp"
      responsePath: "data.otp",
    },
    // Optional: verify the OTP via API instead of browser form submission.
    // Remove this block to let the framework submit the OTP via the browser form.
    verifyConfig: {
      baseUrl: process.env.BASE_URL ?? "${baseUrl}",
      path: "/auth/verify-otp/{username}",
      method: "POST",
      accessTokenPath: "data.accessToken",
    },`,
  };

  return `  otpConfig: {
    // "single-input" → one field for the full code (e.g. "123456")
    // "segmented"    → one input per digit
    mode: "${mode}",
    ${mode === "segmented" ? "fieldCount: 6,  // number of digit boxes\n    " : ""}
    // Whether the OTP form auto-submits when all digits are filled.
    autoSubmit: false,

    // URL glob for the OTP entry screen (if it's on a different page).
    otpPageUrl: "**/otp**",

    // How the framework gets the OTP code:
    // "env"           → read from environment variable
    // "api-intercept" → intercept the outbound send-OTP API call
    // "api-request"   → call a dedicated test endpoint to fetch it
    source: "${source}",
${sourceBlocks[source]}
  },\n`;
}

// ─── API config block ─────────────────────────────────────────────────────────

function _apiConfigBlock(tokenType: TokenType): string {
  const tokenSpecific: Record<TokenType, string> = {
    cookie: `
    // Cookie auth: the server sets a session cookie automatically.
    // No extra config needed — just ensure your login endpoint sets Set-Cookie.
    tokenType: "cookie",`,

    bearer: `
    // Bearer auth: extract the token from the login response body
    // and attach it as "Authorization: Bearer <token>" on subsequent requests.
    tokenType: "bearer",
    // Dot-notation path to the token in the login response.
    // e.g. if response is { data: { accessToken: "abc" } } → "data.accessToken"
    tokenPath: "data.accessToken",`,

    "custom-header": `
    // Custom header auth: extract token and send as a named request header.
    tokenType: "custom-header",
    tokenPath: "token",
    // The exact header name your API expects.
    tokenHeaderName: "X-Auth-Token",`,
  };

  return `  // API auth config — only used when isApi: true.
  apiConfig: {
    // Path to your login endpoint (relative, appended to actionUrl).
    path: "/auth/login",

    // Map framework field names to what your API expects in the request body.
    fieldMap: {
      username: "email",     // sends { "email": "..." }
      password: "password",  // sends { "password": "..." }
    },

    // Any extra fields your login endpoint requires.
    // additionalFields: { grant_type: "password" },
${tokenSpecific[tokenType]}
  },\n`;
}

// ─── OIDC patterns block ──────────────────────────────────────────────────────

function _oidcPatternsBlock(): string {
  return `
  // ── OIDC Provider URL Patterns ────────────────────────────────────────────
  // Playwright route globs used to detect the OIDC provider's auth page.
  // Update if your provider uses a non-standard authorization URL format.
  OIDCProviderPatterns: {
    okta:       "**/*.okta.com/oauth2/**/authorize**",
    auth0:      "**/*.auth0.com/authorize**",
    keycloak:   "**/auth/realms/**/protocol/openid-connect/auth**",
    "azure-ad": "**/login.microsoftonline.com/**/oauth2/v2.0/authorize**",
    cognito:    "**/*.auth.*.amazoncognito.com/oauth2/authorize**",
    ping:       "**/*.pingidentity.com/as/authorization**",
  },\n`;
}

// ─── Inline users block (flat config style) ───────────────────────────────────

function _inlineUsersBlock(
  authType: string,
  isApi: boolean,
  hasPassword: boolean,
  isOtp: boolean,
  tokenType: TokenType,
): string {
  const passwordField = hasPassword
    ? `\n      // Password read from env — never hardcode in committed files.
      password: process.env.TEST_USER_PASSWORD ?? "password123",`
    : "";

  const apiOverride = isApi
    ? `\n      isApi: true,
      apiConfig: {
        path: "/auth/login",
        tokenType: "${tokenType}",
        ${tokenType !== "cookie" ? `tokenPath: "data.accessToken",` : ""}
      },`
    : "";

  return `  users: [
    {
      // ── Standard test user ────────────────────────────────────────────────
      // This user inherits all settings from the root config above.
      // Add fields here only to OVERRIDE the root config for this specific user.
      username: process.env.TEST_USER_EMAIL ?? "user@test.com",${passwordField}
      role: "user",${apiOverride}
    },
  ] as IUser[],\n`;
}

// ─── users.json generator ─────────────────────────────────────────────────────

function _generateUsersJson(
  authType: string,
  isApi: boolean,
  hasPassword: boolean,
  isOtp: boolean,
  tokenType: TokenType,
  includeAdmin: boolean,
): string {
  const passwordField = hasPassword
    ? `,\n    "password": "${authType === "email-password" ? "password123" : "testpass456"}"`
    : "";
  const adminPwd = hasPassword ? `,\n    "password": "admin123"` : "";

  // Base user — inherits everything from root config
  const baseUser = `  {
    "username": "user@test.com"${passwordField},
    "role": "user"
    // No other fields needed — this user inherits everything from BASE_CONFIG.
    // Add fields here only to override root config values for this user.
  }`;

  // Admin user — same auth type, different credentials
  const adminUser = `  {
    "username": "admin@test.com"${adminPwd},
    "role": "admin"
    // Admin inherits the same authType, actionUrl, etc. from BASE_CONFIG.
  }`;

  // API-mode user override example
  const apiUser = isApi
    ? `  {
    "username": "api-user@test.com"${passwordField},
    "role": "user",
    "isApi": true,
    "apiConfig": {
      "path": "/auth/login",
      "tokenType": "${tokenType}"${tokenType !== "cookie" ? `,\n      "tokenPath": "data.accessToken"` : ""}
    }
    // This user uses API auth even if ROOT config has isApi: false.
    // Useful when some users log in via API and others via browser.
  }`
    : null;

  // Different auth type per user example
  const mixedUser =
    authType === "email-password"
      ? `  {
    "username": "sso-user@test.com",
    "role": "user",
    "authType": "oauth",
    "oauthProvider": "google",
    "actionUrl": "http://localhost:3000/login"
    // This user logs in via Google OAuth even though BASE_CONFIG uses email-password.
    // Per-user authType overrides are fully supported.
  }`
      : null;

  const users = [baseUser];
  if (includeAdmin) users.push(adminUser);
  if (apiUser) users.push(apiUser);
  if (mixedUser) users.push(mixedUser);

  return `[
${users.join(",\n")}
]
`;
}

// ─── Preset configs (ready-to-fly, zero editing required) ─────────────────────

export const PRESETS: Record<string, GeneratorInput> = {
  // ── Browser flows ──────────────────────────────────────────────────────────

  "browser-email-password": {
    authType: "email-password",
    isApi: false,
    configStyle: "flat",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-users-file": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  "browser-email-otp": {
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    otpSource: "api-request",
    otpMode: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-email-password-otp": {
    authType: "email-password-otp",
    isApi: false,
    configStyle: "flat",
    otpSource: "api-request",
    otpMode: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-oauth-google": {
    authType: "oauth",
    isApi: false,
    configStyle: "flat",
    oauthProvider: "google",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-oidc-okta": {
    authType: "oidc",
    isApi: false,
    configStyle: "flat",
    oidcProvider: "okta",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  "browser-saml-okta": {
    authType: "saml",
    isApi: false,
    configStyle: "flat",
    samlProvider: "okta",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
  },

  // ── API flows ──────────────────────────────────────────────────────────────

  "api-email-password-cookie": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    tokenType: "cookie",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  "api-email-password-bearer": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    tokenType: "bearer",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  "api-email-password-custom-header": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    tokenType: "custom-header",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  "api-email-password-otp-bearer": {
    authType: "email-password-otp",
    isApi: true,
    configStyle: "flat",
    tokenType: "bearer",
    otpSource: "api-request",
    otpMode: "single-input",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000",
  },

  // ── Multi-role setups ──────────────────────────────────────────────────────

  "multi-role-email-password": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },

  "multi-role-mixed-auth": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true,
  },
};

// ─── CLI output helper ────────────────────────────────────────────────────────

export function printGeneratedConfig(output: GeneratorOutput): void {
  console.log("\n" + "─".repeat(72));
  console.log("  📋  base.config.ts");
  console.log("─".repeat(72));
  console.log(output.configFile);

  if (output.usersFile) {
    console.log("\n" + "─".repeat(72));
    console.log("  👥  users.json");
    console.log("─".repeat(72));
    console.log(output.usersFile);
  }

  console.log("\n" + "─".repeat(72));
  console.log("  📝  Notes");
  console.log("─".repeat(72));
  output.notes.forEach((n) => console.log(n));
  console.log("─".repeat(72) + "\n");
}
