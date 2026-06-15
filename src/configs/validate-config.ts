import {
  IAuthConfig,
  IUser,
  IOTPConfig,
  IAPIAuthConfig,
  AuthType,
  OTPSource,
  OTPMode,
  TokenType,
  AuthMode,
  AuthPageLayout,
  OAuthProvider,
  OIDCProvider,
  SAMLProvider,
} from "../types";

import {
  ConfigValidationError,
  ValidationIssue,
  ValidationLevel,
} from "./ConfigValidationError";

const VALID_AUTH_TYPES = new Set<AuthType>([
  "email-password",
  "email-otp",
  "email-password-otp",
  "oauth",
  "oidc",
  "saml",
  "custom",
]);
const VALID_AUTH_MODES = new Set<AuthMode>(["single", "multi"]);
const VALID_LAYOUTS = new Set<AuthPageLayout>([
  "single-page",
  "progressive-reveal",
  "redirect-to-new-page",
]);
const VALID_OTP_MODES = new Set<OTPMode>(["single-input", "segmented"]);
const VALID_OTP_SOURCES = new Set<OTPSource>([
  "env",
  "api-intercept",
  "api-request",
]);
const VALID_TOKEN_TYPES = new Set<TokenType>([
  "bearer",
  "cookie",
  "custom-header",
]);
const VALID_OAUTH = new Set<OAuthProvider>([
  "google",
  "github",
  "microsoft",
  "facebook",
]);
const VALID_OIDC = new Set<OIDCProvider>([
  "okta",
  "auth0",
  "azure-ad",
  "keycloak",
  "cognito",
  "ping",
]);
const VALID_SAML = new Set<SAMLProvider>([
  "okta",
  "azure",
  "onelogin",
  "ping",
  "adfs",
]);

const BROWSER_ONLY_AUTH_TYPES = new Set<AuthType>(["oauth", "oidc", "saml"]);
const OTP_AUTH_TYPES = new Set<AuthType>(["email-otp", "email-password-otp"]);
const PASSWORD_AUTH_TYPES = new Set<AuthType>([
  "email-password",
  "email-password-otp",
]);

if(!process.env.AUTH_USERS_FILE?.trim()){
  throw new Error("AUTH_USERS_FILE is required in .env file")
}

if(!process.env.USE_API?.trim()){
  throw new Error("USE_API is required in .env file")
}

function createCollector() {
  const issues: ValidationIssue[] = [];

  function add(
    level: ValidationLevel,
    code: string,
    field: string,
    message: string,
    hint?: string,
    user?: string,
  ): void {
    issues.push({ level, code, field, message, hint, user });
  }

  return {
    error: (
      code: string,
      field: string,
      message: string,
      hint?: string,
      _?: undefined,
      user?: string,
    ) => add("error", code, field, message, hint, user),
    warn: (
      code: string,
      field: string,
      message: string,
      hint?: string,
      _?: undefined,
      user?: string,
    ) => add("warning", code, field, message, hint, user),
    issues: () => issues,
  };
}

type Collector = ReturnType<typeof createCollector>;

function isValidUrl(raw: string): boolean {
  try {
    new URL(raw);
    return true;
  } catch {
    return false;
  }
}

function checkUrl(
  c: Collector,
  field: string,
  value: string | undefined,
  user?: string,
): boolean {
  if (!value?.trim()) return false;
  if (!isValidUrl(value)) {
    c.error(
      "INVALID_URL",
      field,
      `"${value}" is not a valid URL. Must start with http:// or https://.`,
      `Use a fully-qualified URL, e.g. "http://localhost:3000".`,
      undefined,
      user,
    );
    return false;
  }
  return true;
}

function validateGlobalStructure(c: Collector, config: IAuthConfig): void {
  if (!config.mode) {
    c.error(
      "MODE_MISSING",
      "mode",
      `"mode" is required. Must be "single" or "multi".`,
    );
  } else if (!VALID_AUTH_MODES.has(config.mode)) {
    c.error(
      "INVALID_MODE",
      "mode",
      `"mode" value "${config.mode}" is not valid.`,
      `Use "single" (shared cached context) or "multi" (fresh context per test).`,
    );
  }

  if(VALID_AUTH_MODES.has(config.mode)){

  }

  if (!config.authType) {
    c.error("AUTH_TYPE_MISSING", "authType", `"authType" is required.`);
  } else if (!VALID_AUTH_TYPES.has(config.authType)) {
    c.error(
      "INVALID_AUTH_TYPE",
      "authType",
      `"authType" value "${config.authType}" is not recognised.`,
      `Valid values: ${[...VALID_AUTH_TYPES].join(", ")}.`,
    );
  }

  if (!config.storageStatePath?.trim()) {
    c.error(
      "STORAGE_PATH_MISSING",
      "storageStatePath",
      `"storageStatePath" is required. This is the directory where session files are saved.`,
      `Set storageStatePath: ".auth" (or any relative/absolute directory path).`,
    );
  }

  if (!config.BASE_SERVER_URL?.trim()) {
    c.error(
      "BASE_SERVER_URL_MISSING",
      "BASE_SERVER_URL",
      `"BASE_SERVER_URL" is required.`,
      `Set it to the base URL of your application, e.g. "http://localhost:3000".`,
    );
  } else {
    checkUrl(c, "BASE_SERVER_URL", config.BASE_SERVER_URL);
  }

  if (!config.actionUrl?.trim()) {
    c.error(
      "ACTION_URL_MISSING",
      "actionUrl",
      `"actionUrl" is required. This is the login page URL (or API endpoint when isApi is true).`,
      `Set actionUrl to your login page URL, e.g. "http://localhost:3000/login".`,
    );
  } else {
    checkUrl(c, "actionUrl", config.actionUrl);
  }

  if (config.authPageLayout && !VALID_LAYOUTS.has(config.authPageLayout)) {
    c.error(
      "INVALID_AUTH_PAGE_LAYOUT",
      "authPageLayout",
      `"authPageLayout" value "${config.authPageLayout}" is not valid.`,
      `Valid values: ${[...VALID_LAYOUTS].join(", ")}.`,
    );
  }

  if (!Array.isArray(config.users) || config.users.length === 0) {
    c.error(
      "USERS_EMPTY",
      "users",
      `"users" is empty. At least one user must be configured.`,
      `Add users to your users.json file and ensure the file path resolves correctly.`,
    );
  }
}

function validateBaseAuthType(c: Collector, config: IAuthConfig): void {
  const { authType, isApi } = config;

  if (OTP_AUTH_TYPES.has(authType)) {
    if (!config.otpConfig) {
      c.error(
        "OTP_CONFIG_MISSING",
        "otpConfig",
        `authType "${authType}" requires an "otpConfig" block in BASE_CONFIG.`,
        `Add otpConfig: { mode: "single-input", source: "api-request", autoSubmit: false, ... }.`,
      );
    } else {
      validateOtpConfig(c, config.otpConfig, "otpConfig");
    }
  }

  if (authType === "oauth") {
    if (isApi) {
      c.error(
        "OAUTH_API_INCOMPATIBLE",
        "authType + isApi",
        `authType "oauth" is incompatible with isApi: true. OAuth requires a browser flow.`,
        `Remove isApi: true, or switch authType to "email-password" for pure API auth.`,
      );
    }
    if (config.oauthProvider && !VALID_OAUTH.has(config.oauthProvider)) {
      c.error(
        "INVALID_OAUTH_PROVIDER",
        "oauthProvider",
        `"oauthProvider" value "${config.oauthProvider}" is not recognised.`,
        `Valid values: ${[...VALID_OAUTH].join(", ")}.`,
      );
    }
    if (!config.oauthProvider) {
      c.warn(
        "OAUTH_PROVIDER_MISSING",
        "oauthProvider",
        `authType "oauth" has no "oauthProvider" set in BASE_CONFIG.`,
        `Set oauthProvider (e.g. "google") or add oauthProvider on each user individually.`,
      );
    }
  }

  if (authType === "oidc") {
    if (isApi) {
      c.error(
        "OIDC_API_INCOMPATIBLE",
        "authType + isApi",
        `authType "oidc" is incompatible with isApi: true. OIDC requires a browser flow.`,
        `Remove isApi: true from BASE_CONFIG and from any oidc users.`,
      );
    }
    if (config.oidcProvider && !VALID_OIDC.has(config.oidcProvider)) {
      c.error(
        "INVALID_OIDC_PROVIDER",
        "oidcProvider",
        `"oidcProvider" value "${config.oidcProvider}" is not recognised.`,
        `Valid values: ${[...VALID_OIDC].join(", ")}.`,
      );
    }
    if (!config.oidcProvider) {
      c.warn(
        "OIDC_PROVIDER_MISSING",
        "oidcProvider",
        `authType "oidc" has no "oidcProvider" set in BASE_CONFIG. Defaulting to "okta".`,
        `Set oidcProvider in BASE_CONFIG or on each oidc user individually.`,
      );
    }
  }

  if (authType === "saml") {
    if (config.samlProvider && !VALID_SAML.has(config.samlProvider)) {
      c.error(
        "INVALID_SAML_PROVIDER",
        "samlProvider",
        `"samlProvider" value "${config.samlProvider}" is not recognised.`,
        `Valid values: ${[...VALID_SAML].join(", ")}.`,
      );
    }
    if (!config.samlProvider) {
      c.warn(
        "SAML_PROVIDER_MISSING",
        "samlProvider",
        `authType "saml" has no "samlProvider" set in BASE_CONFIG. Defaulting to "okta".`,
        `Set samlProvider in BASE_CONFIG or on each saml user individually.`,
      );
    }
  }

  if (authType === "custom" && !config.customStrategy) {
    c.error(
      "CUSTOM_STRATEGY_MISSING",
      "customStrategy",
      `authType "custom" requires a "customStrategy" implementation to be provided.`,
      `Set customStrategy: new YourAuthStrategy() in BASE_CONFIG.`,
    );
  }
}

function validateApiConfig(
  c: Collector,
  apiConfig: IAPIAuthConfig | undefined,
  isApi: boolean | undefined,
  prefix: string,
  user?: string,
): void {
  if (!isApi) return;

  if (!apiConfig) {
    c.error(
      "API_CONFIG_MISSING",
      prefix,
      `isApi: true requires an "apiConfig" block with at minimum a "path" field.`,
      `Add apiConfig: { path: "/auth/login" } ${user ? `to user "${user}"` : "to BASE_CONFIG"}.`,
      undefined,
      user,
    );
    return;
  }

  if (!apiConfig.path?.trim()) {
    c.error(
      "API_CONFIG_PATH_MISSING",
      `${prefix}.path`,
      `apiConfig.path is required when isApi: true.`,
      `Set it to your login endpoint, e.g. "/auth/login".`,
      undefined,
      user,
    );
  } else if (apiConfig.path.startsWith("http")) {
    c.warn(
      "API_PATH_LOOKS_LIKE_FULL_URL",
      `${prefix}.path`,
      `apiConfig.path "${apiConfig.path}" looks like a full URL. It should be a path only (e.g. "/auth/login").`,
      `Move the base URL to actionUrl and keep only the path segment here.`,
      undefined,
      user,
    );
  }

  if (apiConfig.tokenType && !VALID_TOKEN_TYPES.has(apiConfig.tokenType)) {
    c.error(
      "INVALID_TOKEN_TYPE",
      `${prefix}.tokenType`,
      `apiConfig.tokenType "${apiConfig.tokenType}" is not valid.`,
      `Valid values: ${[...VALID_TOKEN_TYPES].join(", ")}.`,
      undefined,
      user,
    );
  }

  if (
    (apiConfig.tokenType === "bearer" ||
      apiConfig.tokenType === "custom-header") &&
    !apiConfig.tokenPath?.trim()
  ) {
    c.warn(
      "TOKEN_PATH_MISSING",
      `${prefix}.tokenPath`,
      `apiConfig.tokenType "${apiConfig.tokenType}" should have "tokenPath" set to locate the token in the response body.`,
      `Set tokenPath using dot notation, e.g. "data.accessToken". Defaults to "token".`,
      undefined,
      user,
    );
  }

  if (
    apiConfig.tokenType === "custom-header" &&
    !apiConfig.tokenHeaderName?.trim()
  ) {
    c.error(
      "TOKEN_HEADER_NAME_MISSING",
      `${prefix}.tokenHeaderName`,
      `apiConfig.tokenType "custom-header" requires "tokenHeaderName" to be set.`,
      `Set tokenHeaderName to the exact header name, e.g. "X-Auth-Token".`,
      undefined,
      user,
    );
  }
}

function validateOtpConfig(
  c: Collector,
  otp: IOTPConfig,
  prefix: string,
  user?: string,
): void {
  if (!otp.mode) {
    c.error(
      "OTP_MODE_MISSING",
      `${prefix}.mode`,
      `otpConfig.mode is required.`,
      `Set to "single-input" (one field for the full code) or "segmented" (one input per digit).`,
      undefined,
      user,
    );
  } else if (!VALID_OTP_MODES.has(otp.mode)) {
    c.error(
      "INVALID_OTP_MODE",
      `${prefix}.mode`,
      `otpConfig.mode "${otp.mode}" is not valid.`,
      `Valid values: "single-input" | "segmented".`,
      undefined,
      user,
    );
  }

  if (otp.mode === "segmented") {
    if (otp.fieldCount === undefined) {
      c.warn(
        "SEGMENTED_FIELD_COUNT_MISSING",
        `${prefix}.fieldCount`,
        `otpConfig.mode "segmented" has no fieldCount. Defaulting to 6.`,
        `Set fieldCount to the number of digit inputs on your OTP form.`,
        undefined,
        user,
      );
    } else if (!Number.isInteger(otp.fieldCount) || otp.fieldCount < 1) {
      c.error(
        "INVALID_SEGMENTED_FIELD_COUNT",
        `${prefix}.fieldCount`,
        `otpConfig.fieldCount must be a positive integer, got "${otp.fieldCount}".`,
        undefined,
        undefined,
        user,
      );
    }
  }

  if (!otp.source) {
    c.error(
      "OTP_SOURCE_MISSING",
      `${prefix}.source`,
      `otpConfig.source is required.`,
      `Valid values: "env" | "api-intercept" | "api-request".`,
      undefined,
      user,
    );
    return;
  } else if (!VALID_OTP_SOURCES.has(otp.source)) {
    c.error(
      "INVALID_OTP_SOURCE",
      `${prefix}.source`,
      `otpConfig.source "${otp.source}" is not valid.`,
      `Valid values: "env" | "api-intercept" | "api-request".`,
      undefined,
      user,
    );
    return;
  }

  if (otp.source === "env") {
    const key = otp.envKey ?? "TEST_OTP";
    if (!otp.envKey) {
      c.warn(
        "OTP_ENV_KEY_MISSING",
        `${prefix}.envKey`,
        `otpConfig.source "env" has no "envKey". Defaulting to "TEST_OTP".`,
        `Set envKey to the name of the environment variable that holds the OTP.`,
        undefined,
        user,
      );
    }
    if (!process.env[key]) {
      c.warn(
        "OTP_ENV_VAR_NOT_SET",
        `${prefix}.envKey`,
        `otpConfig.envKey resolves to "$${key}" but that environment variable is not currently set.`,
        `Export ${key}=<your-test-otp> in your shell or .env file before running tests.`,
        undefined,
        user,
      );
    }
  }

  if (otp.source === "api-intercept") {
    if (!otp.interceptPattern?.trim()) {
      c.warn(
        "OTP_INTERCEPT_PATTERN_MISSING",
        `${prefix}.interceptPattern`,
        `otpConfig.source "api-intercept" has no "interceptPattern". Defaulting to "**/api/send-otp**".`,
        `Set interceptPattern to a Playwright route glob that matches your OTP delivery endpoint.`,
        undefined,
        user,
      );
    }
  }

  if (otp.source === "api-request") {
    validateOtpRequestConfig(c, otp, prefix, user);
  }
}

function validateOtpRequestConfig(
  c: Collector,
  otp: IOTPConfig,
  prefix: string,
  user?: string,
): void {
  if (!otp.requestConfig) {
    c.error(
      "OTP_REQUEST_CONFIG_MISSING",
      `${prefix}.requestConfig`,
      `otpConfig.source "api-request" requires a "requestConfig" block.`,
      `Add requestConfig: { baseUrl: "...", path: "/auth/get-otp/{username}" }.`,
      undefined,
      user,
    );
  } else {
    if (!otp.requestConfig.baseUrl?.trim()) {
      c.error(
        "OTP_REQUEST_BASE_URL_MISSING",
        `${prefix}.requestConfig.baseUrl`,
        `otpConfig.requestConfig.baseUrl is required.`,
        undefined,
        undefined,
        user,
      );
    } else {
      checkUrl(
        c,
        `${prefix}.requestConfig.baseUrl`,
        otp.requestConfig.baseUrl,
        user,
      );
    }

    if (!otp.requestConfig.path?.trim()) {
      c.error(
        "OTP_REQUEST_PATH_MISSING",
        `${prefix}.requestConfig.path`,
        `otpConfig.requestConfig.path is required.`,
        `Set it to your OTP fetch endpoint path. Supports {username} and {userId} placeholders.`,
        undefined,
        user,
      );
    }

    if (
      otp.requestConfig.method &&
      !["GET", "POST"].includes(otp.requestConfig.method)
    ) {
      c.error(
        "INVALID_OTP_REQUEST_METHOD",
        `${prefix}.requestConfig.method`,
        `otpConfig.requestConfig.method "${otp.requestConfig.method}" is not valid.`,
        `Valid values: "GET" | "POST".`,
        undefined,
        user,
      );
    }
  }

  if (!otp.verifyConfig) {
    c.warn(
      "OTP_VERIFY_CONFIG_MISSING",
      `${prefix}.verifyConfig`,
      `otpConfig.source "api-request" has no "verifyConfig". The framework will rely on browser form submission to verify the OTP.`,
      `Add verifyConfig if your app has a dedicated OTP verification endpoint that returns a token.`,
      undefined,
      user,
    );
  } else {
    if (!otp.verifyConfig.baseUrl?.trim()) {
      c.error(
        "OTP_VERIFY_BASE_URL_MISSING",
        `${prefix}.verifyConfig.baseUrl`,
        `otpConfig.verifyConfig.baseUrl is required when verifyConfig is present.`,
        undefined,
        undefined,
        user,
      );
    } else {
      checkUrl(
        c,
        `${prefix}.verifyConfig.baseUrl`,
        otp.verifyConfig.baseUrl,
        user,
      );
    }

    if (!otp.verifyConfig.path?.trim()) {
      c.error(
        "OTP_VERIFY_PATH_MISSING",
        `${prefix}.verifyConfig.path`,
        `otpConfig.verifyConfig.path is required when verifyConfig is present.`,
        undefined,
        undefined,
        user,
      );
    }

    if (
      otp.verifyConfig.method &&
      !["GET", "POST"].includes(otp.verifyConfig.method)
    ) {
      c.error(
        "INVALID_OTP_VERIFY_METHOD",
        `${prefix}.verifyConfig.method`,
        `otpConfig.verifyConfig.method "${otp.verifyConfig.method}" is not valid.`,
        `Valid values: "GET" | "POST".`,
        undefined,
        user,
      );
    }
  }
}

function validateUsers(c: Collector, config: IAuthConfig): void {
  if (!Array.isArray(config.users) || config.users.length === 0) return;

  const seen = new Map<string, number>();
  for (const [idx, user] of config.users.entries()) {
    if (!user.username?.trim()) continue;
    const key = user.username.toLowerCase();
    if (seen.has(key)) {
      c.error(
        "DUPLICATE_USERNAME",
        `users[${idx}].username`,
        `Duplicate username "${user.username}" at index ${idx} (first seen at index ${seen.get(key)}).`,
        `Each user must have a unique username. Remove or rename the duplicate.`,
      );
    } else {
      seen.set(key, idx);
    }
  }

  for (const [idx, user] of config.users.entries()) {
    validateSingleUser(c, config, user, idx);
  }
}

function validateSingleUser(
  c: Collector,
  config: IAuthConfig,
  user: IUser,
  idx: number,
): void {
  if (!user.username?.trim()) {
    c.error(
      "USER_USERNAME_MISSING",
      `users[${idx}].username`,
      `User at index ${idx} has no "username". Every user entry requires a non-empty username.`,
    );
    return;
  }

  const label = `users["${user.username}"]`;
  const u = user.username;

  const effectiveAuthType = user.authType ?? config.authType;
  const effectiveIsApi = user.isApi ?? config.isApi ?? false;
  const effectiveApiConfig =
    user.apiConfig || (effectiveIsApi ? config.apiConfig : undefined);
  const effectiveOtpConfig = user.otpConfig ?? config.otpConfig;
  const effectiveOAuthProv = user.oauthProvider ?? config.oauthProvider;
  const effectiveOIDCProv = user.oidcProvider ?? config.oidcProvider;
  const effectiveSAMLProv = user.samlProvider ?? config.samlProvider;
  const effectiveLayout = user.authPageLayout ?? config.authPageLayout;

  if (user.authType && !VALID_AUTH_TYPES.has(user.authType)) {
    c.error(
      "USER_INVALID_AUTH_TYPE",
      `${label}.authType`,
      `User "${u}" has an unrecognised authType "${user.authType}".`,
      `Valid values: ${[...VALID_AUTH_TYPES].join(", ")}.`,
      undefined,
      u,
    );
    return;
  }

  if (user.authPageLayout && !VALID_LAYOUTS.has(user.authPageLayout)) {
    c.error(
      "USER_INVALID_LAYOUT",
      `${label}.authPageLayout`,
      `User "${u}" has an unrecognised authPageLayout "${user.authPageLayout}".`,
      `Valid values: ${[...VALID_LAYOUTS].join(", ")}.`,
      undefined,
      u,
    );
  }

  if (BROWSER_ONLY_AUTH_TYPES.has(effectiveAuthType) && effectiveIsApi) {
    c.error(
      "USER_BROWSER_ONLY_AUTH_WITH_API",
      `${label}.authType + isApi`,
      `User "${u}" has authType "${effectiveAuthType}" with isApi: true. This combination is not supported — ${effectiveAuthType} requires a browser flow.`,
      `Remove isApi: true from this user (or from BASE_CONFIG if it is inherited).`,
      undefined,
      u,
    );
  }

  if (
    PASSWORD_AUTH_TYPES.has(effectiveAuthType) &&
    !effectiveIsApi &&
    !user.password
  ) {
    c.error(
      "USER_PASSWORD_MISSING",
      `${label}.password`,
      `User "${u}" uses authType "${effectiveAuthType}" but has no "password" set.`,
      `Add "password": "yourPassword" to this user in users.json.`,
      undefined,
      u,
    );
  }

  if (OTP_AUTH_TYPES.has(effectiveAuthType) && !effectiveIsApi) {
    if (!effectiveOtpConfig) {
      c.error(
        "USER_OTP_CONFIG_MISSING",
        `${label}.otpConfig`,
        `User "${u}" uses authType "${effectiveAuthType}" but has no otpConfig — neither on the user nor in BASE_CONFIG.`,
        `Add an otpConfig block directly on this user in users.json, or add a default to BASE_CONFIG.`,
        undefined,
        u,
      );
    } else if (user.otpConfig) {
      validateOtpConfig(c, user.otpConfig, `${label}.otpConfig`, u);
    }
  }

  validateApiConfig(
    c,
    effectiveApiConfig,
    effectiveIsApi,
    `${label}.apiConfig`,
    u,
  );

  if (user.oauthProvider && !VALID_OAUTH.has(user.oauthProvider)) {
    c.error(
      "USER_INVALID_OAUTH_PROVIDER",
      `${label}.oauthProvider`,
      `User "${u}" has an unrecognised oauthProvider "${user.oauthProvider}".`,
      `Valid values: ${[...VALID_OAUTH].join(", ")}.`,
      undefined,
      u,
    );
  }
  if (user.oidcProvider && !VALID_OIDC.has(user.oidcProvider)) {
    c.error(
      "USER_INVALID_OIDC_PROVIDER",
      `${label}.oidcProvider`,
      `User "${u}" has an unrecognised oidcProvider "${user.oidcProvider}".`,
      `Valid values: ${[...VALID_OIDC].join(", ")}.`,
      undefined,
      u,
    );
  }
  if (user.samlProvider && !VALID_SAML.has(user.samlProvider)) {
    c.error(
      "USER_INVALID_SAML_PROVIDER",
      `${label}.samlProvider`,
      `User "${u}" has an unrecognised samlProvider "${user.samlProvider}".`,
      `Valid values: ${[...VALID_SAML].join(", ")}.`,
      undefined,
      u,
    );
  }

  if (effectiveAuthType !== "oauth" && user.oauthProvider) {
    c.warn(
      "USER_OAUTH_PROVIDER_UNUSED",
      `${label}.oauthProvider`,
      `User "${u}" has oauthProvider set but authType is "${effectiveAuthType}". The oauthProvider will be ignored.`,
      undefined,
      undefined,
      u,
    );
  }
  if (effectiveAuthType !== "oidc" && user.oidcProvider) {
    c.warn(
      "USER_OIDC_PROVIDER_UNUSED",
      `${label}.oidcProvider`,
      `User "${u}" has oidcProvider set but authType is "${effectiveAuthType}". The oidcProvider will be ignored.`,
      undefined,
      undefined,
      u,
    );
  }
  if (effectiveAuthType !== "saml" && user.samlProvider) {
    c.warn(
      "USER_SAML_PROVIDER_UNUSED",
      `${label}.samlProvider`,
      `User "${u}" has samlProvider set but authType is "${effectiveAuthType}". The samlProvider will be ignored.`,
      undefined,
      undefined,
      u,
    );
  }

  if (effectiveAuthType === "oauth" && !effectiveOAuthProv) {
    c.warn(
      "USER_OAUTH_PROVIDER_MISSING",
      `${label}.oauthProvider`,
      `User "${u}" uses authType "oauth" but has no oauthProvider (user-level or BASE_CONFIG). Defaulting to "google".`,
      undefined,
      undefined,
      u,
    );
  }
  if (effectiveAuthType === "oidc" && !effectiveOIDCProv) {
    c.warn(
      "USER_OIDC_PROVIDER_MISSING",
      `${label}.oidcProvider`,
      `User "${u}" uses authType "oidc" but has no oidcProvider (user-level or BASE_CONFIG). Defaulting to "okta".`,
      undefined,
      undefined,
      u,
    );
  }
  if (effectiveAuthType === "saml" && !effectiveSAMLProv) {
    c.warn(
      "USER_SAML_PROVIDER_MISSING",
      `${label}.samlProvider`,
      `User "${u}" uses authType "saml" but has no samlProvider (user-level or BASE_CONFIG). Defaulting to "okta".`,
      undefined,
      undefined,
      u,
    );
  }

  if (!user.actionUrl && !config.actionUrl) {
    c.error(
      "USER_ACTION_URL_MISSING",
      `${label}.actionUrl`,
      `User "${u}" has no "actionUrl" and BASE_CONFIG has no fallback "actionUrl" either.`,
      `Add "actionUrl": "http://..." to this user in users.json, or set a default in BASE_CONFIG.`,
      undefined,
      u,
    );
  } else if (user.actionUrl) {
    checkUrl(c, `${label}.actionUrl`, user.actionUrl, u);
  }
}

function validateCrossFieldRules(c: Collector, config: IAuthConfig): void {
  if (
    config.BASE_SERVER_URL &&
    config.actionUrl &&
    config.isApi &&
    config.apiConfig?.path
  ) {
    try {
      const base = new URL(config.BASE_SERVER_URL);
      const action = new URL(config.actionUrl);
      const apiPath = config.apiConfig.path;

      if (action.pathname !== "/" && action.pathname === apiPath) {
        c.warn(
          "ACTION_URL_PATH_MATCHES_API_PATH",
          "actionUrl + apiConfig.path",
          `actionUrl path ("${action.pathname}") is identical to apiConfig.path ("${apiPath}"). ` +
            `The login URL will be constructed as "${config.actionUrl}${apiPath}" which duplicates the segment.`,
          `Set actionUrl to the base origin only (e.g. "${base.origin}") and put the login path in apiConfig.path.`,
        );
      }
    } catch {}
  }

  if (config.storageStatePath?.includes("..")) {
    c.warn(
      "STORAGE_PATH_TRAVERSAL",
      "storageStatePath",
      `storageStatePath "${config.storageStatePath}" contains ".." which may resolve outside the project root.`,
      `Use a path relative to the project root without ".." traversal, e.g. ".auth" or "tmp/sessions".`,
    );
  }

  if (
    config.rateLimited &&
    Array.isArray(config.users) &&
    config.users.length === 1
  ) {
    c.warn(
      "RATE_LIMITED_SINGLE_USER",
      "rateLimited",
      `rateLimited: true has no effect when there is only one user — there is nothing to throttle.`,
      `Remove rateLimited: true to avoid a misleading 500ms delay during setup.`,
    );
  }

  if (OTP_AUTH_TYPES.has(config.authType) && !config.otpConfig) {
    const missing = (config.users ?? []).filter(
      (u) => !u.otpConfig && !(u.authType && !OTP_AUTH_TYPES.has(u.authType)),
    );
    if (missing.length >= 3) {
      c.warn(
        "BULK_OTP_CONFIG_MISSING",
        "otpConfig",
        `${missing.length} users inherit authType "${config.authType}" but BASE_CONFIG has no otpConfig. ` +
          `Each of these users will need their own otpConfig block.`,
        `Consider adding a default otpConfig to BASE_CONFIG so users inherit it automatically.`,
      );
    }
  }
}

export function validateConfig(config: IAuthConfig): void {
  const c = createCollector();

  validateGlobalStructure(c, config);
  validateBaseAuthType(c, config);
  validateApiConfig(c, config.apiConfig, config.isApi, "apiConfig");
  validateUsers(c, config);
  validateCrossFieldRules(c, config);

  const issues = c.issues();
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  if (warnings.length > 0) {
    const warningLines = [
      `\n\x1b[33m\x1b[1m[PWMAF] Config validation: ${warnings.length} warning(s)\x1b[0m`,
      ...warnings.map(
        (w, i) =>
          `  \x1b[33m[${i + 1}] ${w.code}\x1b[0m  ${w.field}\n      ${w.message}` +
          (w.hint ? `\n      \x1b[2mFix: ${w.hint}\x1b[0m` : ""),
      ),
      "",
    ];
    process.stderr.write(warningLines.join("\n") + "\n");
  }

  if (errors.length > 0) {
    throw new ConfigValidationError([...issues]);
  }
}

export { ConfigValidationError } from "./ConfigValidationError";
export type { ValidationIssue, ValidationLevel } from "./ConfigValidationError";
