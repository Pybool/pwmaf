#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cli/init.ts
var init_exports = {};
__export(init_exports, {
  writeFiles: () => writeFiles
});
module.exports = __toCommonJS(init_exports);
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var rl = __toESM(require("readline"));

// src/cli/config-generator.ts
var BROWSER_ONLY = /* @__PURE__ */ new Set(["oauth", "oidc", "saml"]);
var OTP_TYPES = /* @__PURE__ */ new Set(["email-otp", "email-password-otp"]);
var PWD_TYPES = /* @__PURE__ */ new Set([
  "email-password",
  "email-password-otp"
]);
function resolveOtpStrategy(mode, explicit) {
  const warnings = [];
  if (!explicit) {
    return {
      strategy: mode === "segmented" ? "multi-input" : "single-input",
      warnings
    };
  }
  if (mode === "single-input" && explicit === "multi-input") {
    warnings.push(
      `\u26A0\uFE0F  otpStrategy "multi-input" is unusual with mode "single-input". multi-input fills each digit into a separate nth(i) input \u2014 but mode "single-input" implies one field for the full code. Did you mean strategy "single-input" or mode "segmented"?`
    );
  }
  if (mode === "single-input" && explicit === "hidden-input") {
    warnings.push(
      `\u26A0\uFE0F  otpStrategy "hidden-input" with mode "single-input" is uncommon. "hidden-input" uses pressSequentially() on a hidden field \u2014 this is designed for visually-segmented UIs. Consider mode "segmented" + strategy "hidden-input" if your OTP UI shows individual boxes.`
    );
  }
  if (mode === "segmented" && explicit === "single-input") {
    warnings.push(
      `\u26A0\uFE0F  otpStrategy "single-input" with mode "segmented" will call fill() on the FIRST input it finds. If your UI has genuine separate inputs per digit, use strategy "multi-input". If it's a hidden input driving visual boxes, use strategy "hidden-input".`
    );
  }
  return { strategy: explicit, warnings };
}
function generateConfig(input) {
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
    includeAdminUser = true
  } = input;
  const notes = [];
  const effectiveIsApi = BROWSER_ONLY.has(authType) ? false : isApi;
  if (BROWSER_ONLY.has(authType) && isApi) {
    notes.push(
      `\u26A0\uFE0F  authType "${authType}" is browser-only. isApi has been forced to false.`
    );
  }
  const isOtp = OTP_TYPES.has(authType);
  const hasPassword = PWD_TYPES.has(authType);
  let resolvedOtpStrategy = "single-input";
  if (isOtp) {
    const { strategy, warnings } = resolveOtpStrategy(otpMode, rawOtpStrategy);
    resolvedOtpStrategy = strategy;
    notes.push(...warnings);
  }
  const otpSection = isOtp ? _otpConfigBlock(otpSource, otpMode, resolvedOtpStrategy, baseUrl) : null;
  const apiSection = effectiveIsApi ? _apiConfigBlock(tokenType) : null;
  const oauthSection = authType === "oauth" ? `  oauthProvider: "${oauthProvider}",
` : "";
  const oidcSection = authType === "oidc" ? `  oidcProvider: "${oidcProvider}",
` : "";
  const samlSection = authType === "saml" ? `  samlProvider: "${samlProvider}",
` : "";
  const userParams = {
    authType,
    authPageLayout,
    actionUrl,
    effectiveIsApi,
    hasPassword,
    isOtp,
    tokenType,
    includeAdminUser,
    baseUrl
  };
  let usersBlock;
  let usersFile = null;
  if (configStyle === "flat") {
    usersBlock = _inlineUsersBlock(userParams);
    notes.push(
      "[Config style] : FLAT \u2014 users are defined inline in base.config.ts."
    );
    notes.push("   Ideal for: single-user setups, quick starts, simple apps.");
  } else {
    usersBlock = `  // Users are loaded automatically from users.json.
  users: [] as IUser[],
`;
    usersFile = _generateUsersJson(userParams);
    notes.push(
      "[Config style] : USERS-FILE \u2014 users are defined in users.json."
    );
    notes.push("   Ideal for: multi-role apps, different auth flows per user.");
    if (includeAdminUser) {
      notes.push("   Includes: standard user + admin user examples.");
    }
  }
  const oidcPatternsBlock = authType === "oidc" ? _oidcPatternsBlock() : "";
  const localStorageOptionsBlock = _localStorageOptions(
    input.tokenStorageConfig
  );
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
    resolvedOtpStrategy
  });
  notes.push(`
[OK] Auth type      : ${authType}`);
  notes.push(
    `[OK] Mode           : ${effectiveIsApi ? "API (direct HTTP)" : "Browser (Playwright)"}`
  );
  notes.push(`[OK] Layout         : ${authPageLayout}`);
  if (isOtp) {
    notes.push(`[OK] OTP render     : ${otpMode}`);
    notes.push(`[OK] OTP strategy   : ${resolvedOtpStrategy}`);
    if (resolvedOtpStrategy === "hidden-input") {
      notes.push(
        '   \u21B3 hidden-input: pressSequentially() on <input autocomplete="one-time-code">.',
        "   \u21B3 Confirm in DevTools: look for one hidden input behind the visual boxes."
      );
    }
  }
  notes.push(`[OK] Config file    : base.config.ts`);
  if (usersFile) notes.push(`[OK] Users file     : users.json`);
  notes.push(`
Next steps:`);
  notes.push(`  1. Set BASE_SERVER_URL and actionUrl to your actual app URLs`);
  if (hasPassword)
    notes.push(
      `  2. Replace TEST_USER_PASSWORD in .env with real test credentials`
    );
  if (isOtp) {
    notes.push(
      `  3. Configure otpConfig.requestConfig to point at your OTP endpoint`
    );
    if (resolvedOtpStrategy === "hidden-input") {
      notes.push(
        `     Also: verify the hidden-input selector matches your app's DOM`
      );
      notes.push(`     (default: input[autocomplete="one-time-code"])`);
    }
  }
  if (effectiveIsApi)
    notes.push(
      `  ${isOtp ? "4" : "3"}. Set apiConfig.path to your login endpoint`
    );
  notes.push(`  Run: npx playwright test --project=setup`);
  return { configFile, usersFile, notes };
}
function _assembleConfigFile(p) {
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
    resolvedOtpStrategy
  } = p;
  const otpSelectorComment = otpSection ? `    // OTP field selectors \u2014 depends on otpConfig.strategy:
    //   "single-input"  => matches the single text input
    //   "hidden-input"  => MUST match input[autocomplete="one-time-code"]
    //                     (leave empty to use the built-in default)
    //   "multi-input"   => matches each digit input (nth(i) is applied)
    otpSingleField:  "",   // strategy: single-input  | default: input[name="otp"]
    otpHiddenField:  "",   // strategy: hidden-input  | default: input[autocomplete="one-time-code"]
    otpMultiFields:  "",   // strategy: multi-input   | default: [data-testid="otp-digit"]` : `    otpSingleField:  "",   // default: input[name="otp"]
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

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// BASE CONFIG
// Generated by: npx pwmaf init
// Auth type:    ${authType}
// Mode:         ${effectiveIsApi ? "API (direct HTTP calls)" : "Browser (Playwright navigates the login page)"}
// Layout:       ${authPageLayout}
// Config style: ${configStyle === "flat" ? "Flat (users defined inline)" : "Users-file (users.json)"}
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export const BASE_CONFIG: IAuthConfig = {

  // \u2500\u2500 Core \u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

  // \u2500\u2500 URLs \u2500\u2500\u2500\u2500\u2500\u2500\u2500

  // Base URL of the application. No trailing slash.
  BASE_SERVER_URL: process.env.BASE_URL ?? "${baseUrl}",

  // Login page URL (browser flows) or API base URL (API flows).
  // This is also set on each user object \u2014 per-user actionUrl takes precedence.
  actionUrl: process.env.ACTION_URL ?? "${actionUrl}",

  // URL glob Playwright waits for after a successful login.
  successUrl: "**/dashboard**",

  // \u2500\u2500 Browser Login Layout 
  // How the login form is structured. Inherited by all users unless overridden.
  //
  // "single-page"          => email + password visible together on page load
  // "progressive-reveal"   => email submitted first, password field reveals after
  // "redirect-to-new-page" => submitting email navigates to a new password page
  authPageLayout: "${authPageLayout}",

  // \u2500\u2500 Users \u2500\u2500\u2500\u2500\u2500\u2500
${usersBlock}
${otpSection ? `  // \u2500\u2500 OTP Configuration 
  // Required for authType "email-otp" or "email-password-otp".
  // mode (visual)   => what the UI looks like
  // strategy (fill) => how Playwright actually interacts with the input
${otpSection}` : ""}
  // \u2500\u2500 API Auth \u2500\u2500\u2500
  // true  => skip browser; POST credentials directly to your login API
  // false => use browser (required for oauth, oidc, saml)
  isApi: ${effectiveIsApi},

${apiSection ? apiSection : `  // apiConfig is only needed when isApi: true.
  // apiConfig: { path: "/auth/login", tokenType: "cookie" },
`}
  // \u2500\u2500 Parallelism 
  // true  => login users sequentially with a 500ms delay between each
  //         (use if your auth endpoint rate-limits concurrent requests)
  // false => all users authenticated in parallel via Promise.all (default)
  rateLimited: false,

  // \u2500\u2500 Re-auth \u2500\u2500\u2500\u2500
  // true  => expired sessions are automatically re-authenticated
  // false => use stale session as-is (tests may see 401s after token expiry)
  allowReauth: true,

  // \u2500\u2500 Selectors \u2500\u2500
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
function _otpConfigBlock(source, mode, strategy, baseUrl) {
  const strategyDocs = {
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
    //   Common in: Okta Verify, Twilio Verify, TOTP widgets.`
  };
  return `  otpConfig: {
    // \u2500\u2500 Visual appearance (mode) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // "single-input" => one text box the user types the full code into
    // "segmented"    => individual boxes displayed per digit (6 by default)
    mode: "${mode}",
    ${mode === "segmented" ? `
    // Number of digit boxes shown in the segmented UI.
    fieldCount: 6,
    ` : ""}
    // \u2500\u2500 Interaction strategy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Tells Playwright HOW to fill the OTP field. Choose based on the DOM, not
    // on how the UI looks \u2014 visually segmented \u2260 technically multi-input.
    //
    // "single-input"  => one real <input> for the whole code${strategyDocs["single-input"]}
    //
    // "hidden-input"  => segmented UI backed by one hidden <input>${strategyDocs["hidden-input"]}
    //
    // "multi-input"   => each box is a genuine separate <input>${strategyDocs["multi-input"]}
    strategy: "${strategy}",

    // \u2500\u2500 Submission \u2500
    // true  => OTP form submits automatically when all digits are filled
    //         (no button click needed \u2014 saves one interaction step)
    // false => framework clicks the OTP submit button after filling
    autoSubmit: false,

    // URL glob for the OTP page (only if authPageLayout is "redirect-to-new-page").
    otpPageUrl: "**/otp**",

    // \u2500\u2500 OTP Source \u2500
    // "env"           => OTP read from process.env[envKey]
    // "api-intercept" => OTP captured from an intercepted outbound API response
    // "api-request"   => OTP fetched by calling a dedicated test endpoint
    source: "${source}",
${_otpSourceBlock(source, baseUrl)}
  },
`;
}
function _otpSourceBlock(source, baseUrl) {
  switch (source) {
    case "env":
      return `
    // \u2500\u2500 source: "env" \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Name of the environment variable that holds the static OTP.
    // Useful for fixed test OTPs in local dev or seed-based CI environments.
    envKey: "TEST_OTP",
    // Export before running tests: TEST_OTP=123456 npx playwright test
`;
    case "api-intercept":
      return `
    // \u2500\u2500 source: "api-intercept" \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Playwright route glob matching the API call your app makes to send the OTP.
    // The framework intercepts this call and reads the OTP from the response body.
    // Adjust the pattern to match your actual OTP delivery endpoint.
    interceptPattern: "**/api/auth/otp/send**",
`;
    case "api-request":
      return `
    // \u2500\u2500 source: "api-request" \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
function _apiConfigBlock(tokenType) {
  const tokenDocs = {
    cookie: `
    // Cookie auth: the server sets a session cookie in the Set-Cookie header.
    // No extra extraction needed \u2014 Playwright's request context carries it automatically.
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
    tokenHeaderName: "X-Auth-Token",   // exact header name your API expects`
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
  },
`;
}
function _oidcPatternsBlock() {
  return `
  // \u2500\u2500 OIDC Provider URL Patterns \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
  },
`;
}
function _localStorageOptions(tokenStorage) {
  if (!tokenStorage) {
    return `
  // \u2500\u2500 Token Storage (optional) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
  // \u2500\u2500 Token Storage \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  tokenStorage: {
    storageType:  "${tokenStorage.storageType}",
    storageKey:   "${tokenStorage.storageKey}",${tokenStorage.tokenPath ? `
    tokenPath:    "${tokenStorage.tokenPath}",` : ""}${tokenStorage.origin ? `
    origin:       "${tokenStorage.origin}",` : ""}${tokenStorage.headerName ? `
    headerName:   "${tokenStorage.headerName}",` : ""}${tokenStorage.attachBearer !== void 0 ? `
    attachBearer: ${tokenStorage.attachBearer},` : ""}
  },
`;
}
function _inlineUsersBlock(p) {
  const {
    authType,
    authPageLayout,
    actionUrl,
    effectiveIsApi,
    hasPassword,
    tokenType
  } = p;
  const passwordLine = hasPassword ? `
      // Never hardcode passwords \u2014 read from env vars.
      password: process.env.TEST_USER_PASSWORD ?? "password123",` : "";
  const apiOverride = effectiveIsApi ? `
      isApi: true,
      apiConfig: {
        path: "/auth/login",
        tokenType: "${tokenType}",${tokenType !== "cookie" ? `
        tokenPath: "data.accessToken",` : ""}
      },` : "";
  return `  users: [
    {
      // \u2500\u2500 Test user \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      // authType, authPageLayout and actionUrl are set explicitly here so that
      // changing the root config values above never silently affects this user.
      username:       process.env.TEST_USER_EMAIL ?? "user@test.com",${passwordLine}
      role:           "user",
      authType:       "${authType}",
      authPageLayout: "${authPageLayout}",
      actionUrl:      process.env.ACTION_URL ?? "${actionUrl}",${apiOverride}
    },
  ] as IUser[],
`;
}
function _generateUsersJson(p) {
  const {
    authType,
    authPageLayout,
    actionUrl,
    effectiveIsApi,
    hasPassword,
    tokenType,
    includeAdminUser
  } = p;
  const pwdUser = hasPassword ? `,
    "password": "password123"` : "";
  const pwdAdmin = hasPassword ? `,
    "password": "admin123"` : "";
  const apiFields = effectiveIsApi ? `,
    "isApi": true,
    "apiConfig": {
      "path": "/auth/login",
      "tokenType": "${tokenType}"${tokenType !== "cookie" ? `,
      "tokenPath": "data.accessToken"` : ""}
    }` : "";
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
  const mixedAuthExample = authType === "email-password" ? `  {
    "username": "sso-user@test.com",
    "role": "user",
    "authType": "oauth",
    "oauthProvider": "google",
    "authPageLayout": "single-page",
    "actionUrl": "${actionUrl}"
    // This user logs in via Google OAuth even though BASE_CONFIG uses email-password.
    // Per-user authType, authPageLayout, and actionUrl overrides are fully supported.
  }` : null;
  const rows = [standardUser];
  if (includeAdminUser) rows.push(adminUser);
  if (mixedAuthExample) rows.push(mixedAuthExample);
  return `[
${rows.join(",\n")}
]
`;
}
var PRESETS = {
  // ── Email + Password ────────────────────────────────────────────────────────
  "browser-email-password-flat": {
    authType: "email-password",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-email-password-progressive-flat": {
    authType: "email-password",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "progressive-reveal",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-email-password-users-file": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true
  },
  "browser-email-password-progressive-users-file": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "progressive-reveal",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true
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
    actionUrl: "http://localhost:3000/login"
  },
  "browser-email-otp-segmented-real-inputs": {
    // Each digit box is a genuine separate <input> element.
    authType: "email-otp",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    otpSource: "api-request",
    otpMode: "segmented",
    otpStrategy: "multi-input",
    // ← real nth(i) inputs
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
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
    otpStrategy: "hidden-input",
    // ← pressSequentially on hidden input
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
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
    actionUrl: "http://localhost:3000/login"
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
    actionUrl: "http://localhost:3000/login"
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
    actionUrl: "http://localhost:3000/login"
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
    includeAdminUser: true
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
    actionUrl: "http://localhost:3000/login"
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
    actionUrl: "http://localhost:3000/login"
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
    actionUrl: "http://localhost:3000/login"
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
    actionUrl: "http://localhost:3000/login"
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
    actionUrl: "http://localhost:3000/login"
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
    includeAdminUser: true
  },
  // ── OAuth / OIDC / SAML ─────────────────────────────────────────────────────
  "browser-oauth-google": {
    authType: "oauth",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oauthProvider: "google",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-oauth-github": {
    authType: "oauth",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oauthProvider: "github",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-oauth-microsoft": {
    authType: "oauth",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oauthProvider: "microsoft",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-oidc-okta": {
    authType: "oidc",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oidcProvider: "okta",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-oidc-auth0": {
    authType: "oidc",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oidcProvider: "auth0",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-oidc-azure-ad": {
    authType: "oidc",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    oidcProvider: "azure-ad",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-saml-okta": {
    authType: "saml",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    samlProvider: "okta",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  "browser-saml-azure": {
    authType: "saml",
    isApi: false,
    configStyle: "flat",
    authPageLayout: "single-page",
    samlProvider: "azure",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login"
  },
  // ── API flows
  "api-email-password-cookie": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "cookie",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000"
  },
  "api-email-password-bearer": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "bearer",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000"
  },
  "api-email-password-custom-header": {
    authType: "email-password",
    isApi: true,
    configStyle: "flat",
    authPageLayout: "single-page",
    tokenType: "custom-header",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000"
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
    actionUrl: "http://localhost:3000"
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
    actionUrl: "http://localhost:3000"
  },
  // ── Multi-role / users-file ─────────────────────────────────────────────────
  "multi-role-email-password": {
    authType: "email-password",
    isApi: false,
    configStyle: "users-file",
    authPageLayout: "single-page",
    baseUrl: "http://localhost:3000",
    actionUrl: "http://localhost:3000/login",
    includeAdminUser: true
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
    includeAdminUser: true
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
    includeAdminUser: true
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
      attachBearer: true
    }
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
      attachBearer: true
    }
  }
};
function printGeneratedConfig(output) {
  const rule = "\u2500".repeat(72);
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

// src/utils/logger.ts
var logger = {
  ok: (msg) => console.log(`[OK] ${msg}`),
  skip: (msg) => console.log(`[SKIP] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  info: (msg) => console.log(`[INFO] ${msg}`)
};

// src/utils/findProjectRoot.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
function findProjectRoot(startDir = process.cwd()) {
  let dir = startDir;
  while (true) {
    const pkgPath = import_path.default.join(dir, "package.json");
    if (import_fs.default.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(import_fs.default.readFileSync(pkgPath, "utf-8"));
        if (pkg && typeof pkg === "object") {
          return dir;
        }
      } catch {
      }
    }
    const parent = import_path.default.dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

// src/cli/init.ts
var iface = rl.createInterface({
  input: process.stdin,
  output: process.stdout
});
function ask(question) {
  return new Promise(
    (resolve2) => iface.question(`
${question} `, (ans) => resolve2(ans.trim()))
  );
}
function askChoice(question, choices, defaultValue) {
  const choiceStr = choices.map((c, i) => `  ${i + 1}. ${c}${c === defaultValue ? " (default)" : ""}`).join("\n");
  return ask(`${question}
${choiceStr}
\u2192`).then((ans) => {
    const num = parseInt(ans);
    if (!isNaN(num) && num >= 1 && num <= choices.length) {
      return choices[num - 1];
    }
    return defaultValue;
  });
}
function askYesNo(question, defaultValue) {
  const hint = defaultValue ? "[Y/n]" : "[y/N]";
  return ask(`${question} ${hint}`).then((ans) => {
    if (!ans) return defaultValue;
    return ans.toLowerCase().startsWith("y");
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list-presets")) {
    console.log("\nAvailable presets:\n");
    Object.keys(PRESETS).forEach((key) => {
      const p = PRESETS[key];
      console.log(
        `  ${key.padEnd(40)} authType: ${p.authType}, isApi: ${p.isApi}, style: ${p.configStyle}`
      );
    });
    console.log("\nUsage: npx pwmaf init --preset <name>\n");
    process.exit(0);
  }
  const presetIdx = args.indexOf("--preset");
  if (presetIdx !== -1) {
    const presetName = args[presetIdx + 1];
    if (!presetName || !PRESETS[presetName]) {
      console.error(
        `
\u274C  Unknown preset "${presetName}". Run --list-presets to see options.
`
      );
      process.exit(1);
    }
    const output2 = generateConfig(PRESETS[presetName]);
    const dryRun2 = args.includes("--dry-run");
    if (dryRun2) {
      printGeneratedConfig(output2);
    } else {
      await writeFiles(output2, args);
    }
    iface.close();
    return;
  }
  console.log(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551           PWMAF \u2014 Auth Config Generator                      \u2551
\u2551           npx pwmaf init                                     \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D

Answer a few questions and we'll generate a ready-to-fly config.
Press Enter to accept the default value shown in (parentheses).
`);
  const authType = await askChoice(
    "1. What authentication type does your app use?",
    [
      "email-password",
      "email-otp",
      "email-password-otp",
      "oauth",
      "oidc",
      "saml",
      "custom"
    ],
    "email-password"
  );
  const browserOnly = ["oauth", "oidc", "saml"].includes(authType);
  let isApi = false;
  if (!browserOnly) {
    isApi = await askYesNo(
      `2. Use direct API calls instead of browser navigation?
   (true = POST credentials directly; false = Playwright navigates the login page)`,
      false
    );
  } else {
    console.log(
      `
2. authType "${authType}" requires browser navigation. isApi: false (auto-set).`
    );
  }
  const configStyleInput = await askChoice(
    `3. Config style?
   flat       \u2192 single user defined inline in base.config.ts (simplest)
   users-file \u2192 users defined in users.json, config holds defaults (multi-role)`,
    ["flat", "users-file"],
    "flat"
  );
  const configStyle = configStyleInput;
  const baseUrl = await ask(
    `4. Base URL of your app (press Enter for http://localhost:3000):`
  ) || "http://localhost:3000";
  const defaultActionUrl = isApi ? baseUrl : `${baseUrl}/login`;
  const actionUrl = await ask(
    `5. Login URL${isApi ? " (API base URL)" : " (login page URL)"} (press Enter for ${defaultActionUrl}):`
  ) || defaultActionUrl;
  let oauthProvider;
  let oidcProvider;
  let samlProvider;
  if (authType === "oauth") {
    oauthProvider = await askChoice(
      "6. OAuth provider?",
      ["google", "github", "microsoft", "facebook"],
      "google"
    );
  }
  if (authType === "oidc") {
    oidcProvider = await askChoice(
      "6. OIDC provider?",
      ["okta", "auth0", "azure-ad", "keycloak", "cognito", "ping"],
      "okta"
    );
  }
  if (authType === "saml") {
    samlProvider = await askChoice(
      "6. SAML provider?",
      ["okta", "azure", "onelogin", "ping", "adfs"],
      "okta"
    );
  }
  let otpSource;
  let otpMode;
  const isOtp = ["email-otp", "email-password-otp"].includes(authType);
  if (isOtp) {
    otpMode = await askChoice(
      "6. OTP input mode?",
      ["single-input", "segmented"],
      "single-input"
    );
    otpSource = await askChoice(
      `7. How should the framework get the OTP code?
   env           \u2192 read from environment variable (TEST_OTP=...)
   api-intercept \u2192 intercept the outbound send-OTP request
   api-request   \u2192 call a dedicated test endpoint to fetch it`,
      ["env", "api-intercept", "api-request"],
      "api-request"
    );
  }
  let tokenType;
  if (isApi) {
    tokenType = await askChoice(
      "8. How does your API return the auth token?",
      ["cookie", "bearer", "custom-header"],
      "cookie"
    );
  }
  let includeAdminUser = false;
  if (configStyle === "users-file") {
    includeAdminUser = await askYesNo(
      "Include an admin user example in users.json?",
      true
    );
  }
  const input = {
    authType,
    isApi,
    configStyle,
    baseUrl,
    actionUrl,
    oauthProvider,
    oidcProvider,
    samlProvider,
    otpSource,
    otpMode,
    tokenType,
    includeAdminUser
  };
  const output = generateConfig(input);
  const preview = await askYesNo(
    "\nPreview the generated config before writing to disk?",
    true
  );
  if (preview) {
    printGeneratedConfig(output);
  }
  const dryRun = args.includes("--dry-run");
  if (!dryRun) {
    await writeFiles(output, args);
  } else {
    console.log("\n\u26A0\uFE0F  --dry-run: files not written.\n");
  }
  iface.close();
}
async function writeFiles(output, args) {
  const projectRoot = findProjectRoot();
  const outDir = (() => {
    const i = args.indexOf("--out");
    if (i !== -1 && args[i + 1]) {
      return path2.resolve(projectRoot, args[i + 1]);
    }
    return projectRoot;
  })();
  fs2.mkdirSync(outDir, { recursive: true });
  const configPath = path2.join(projectRoot, "base.config.ts");
  const configExists = fs2.existsSync(configPath);
  let writeConfig = true;
  if (configExists) {
    writeConfig = await askYesNo(
      `[WARN] ${configPath} exists. Overwrite?`,
      false
    );
  }
  if (writeConfig) {
    fs2.writeFileSync(configPath, output.configFile, "utf-8");
    logger.ok(`Written ${configPath}`);
  } else {
    logger.skip(`Skipped ${configPath}`);
  }
  if (output.usersFile) {
    const dataDir = path2.join(projectRoot, "data");
    const usersPath = path2.join(dataDir, "users.json");
    fs2.mkdirSync(dataDir, { recursive: true });
    const exists = fs2.existsSync(usersPath);
    let writeUsers = true;
    if (exists) {
      writeUsers = await askYesNo(
        `[WARN] ${usersPath} exists. Overwrite?`,
        false
      );
    }
    if (writeUsers) {
      fs2.writeFileSync(usersPath, output.usersFile, "utf-8");
      logger.ok(`Written ${usersPath}`);
    } else {
      logger.skip(`Skipped ${usersPath}`);
    }
  }
  logger.info("Done. Next steps:");
  logger.info("npx playwright test --project=setup");
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  writeFiles
});
