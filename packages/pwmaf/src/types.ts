import type { Browser, BrowserContext, Page, Locator } from "@playwright/test";

import { IAuthStrategy } from "./strategeies/IAuthStrategy";
import type { AuthManager } from "./core/AuthManager";

export type AuthMode = "single" | "multi";
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

export interface IOIDCConfig {
  provider: OIDCProvider;
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  redirectUri?: string;
  scope?: string;
  mockServerUrl?: string;
}

export type SAMLProvider = "okta" | "azure" | "onelogin" | "ping" | "adfs";

export type StorageState = {
  cookies: {
    name: string;
    value: string;
  }[];
};

export type UserRole = "admin" | "user" | "guest";
export type EmailAuthMode = "email-then-password" | "email-only";
export type AuthPageLayout =
  | "single-page"
  | "progressive-reveal"
  | "redirect-to-new-page";
export type OTPMode = "single-input" | "segmented";
export type OTPSource = "env" | "api-intercept" | "api-request";
export type OTPRequestMethod = "GET" | "POST";
export type OTPVerificationMethod = "GET" | "POST";
export type OtpDeliveryChannel = "email" | "sms" | "authenticator-app";
export type TokenType = "bearer" | "cookie" | "custom-header";
export type otpStrategy = "single-input" | "hidden-input" | "multi-input";

export interface IOTPRequestConfig {
  baseUrl: string;
  path: string;
  method?: OTPRequestMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: Record<string, unknown>;
  responsePath?: string;
}

export interface IOTPVerificationConfig {
  baseUrl: string;
  path: string;
  method?: OTPVerificationMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: Record<string, unknown>;
  accessTokenPath?: string;
  refreshTokenPath?: string;
}

export interface IOTPConfig {
  mode: OTPMode;
  strategy: otpStrategy;
  autoSubmit: boolean;
  fieldCount?: number;
  source: OTPSource;
  otpPageUrl?: string;
  envKey?: string;
  interceptPattern?: string;
  requestConfig?: IOTPRequestConfig;
  verifyConfig?: IOTPVerificationConfig;
}

export interface IUser {
  username: string;
  password?: string;
  role?: UserRole;
  // the 5 below are meant to override, the defaults in bas.config, useful when different -
  // users have to login to platforms with different authentication shape and flow e.g in Approvals flow if you wanna perform actions and see that updates are happenig in realtime across what users see
  authType?: AuthType;
  oauthProvider?: OAuthProvider;
  oidcProvider?: OIDCProvider;
  samlProvider?: SAMLProvider;

  authPageLayout?: AuthPageLayout;
  isApi?: boolean;
  
  oidcConfig?: IOIDCConfig;
  otpConfig?: IOTPConfig;
  apiConfig?: IAPIAuthConfig;
  actionUrl?: string; // I have done this becos not all users may have to login to the same url,this will overide the actionUrl inn IAuthConfig

  tokenStorageConfig?: TokenStorageConfig;
}

export interface AuthOverrideSelectors {
  emailOrUsernameField?: string;
  passwordField?: string;
  otpHiddenField?: string;
  otpSingleField?: string;
  otpMultiFields?: string;
  emailSubmitButton?: string;
  passwordSubmitButton?: string;
  otpSubmitButton?: string;
  googleOAuthButton?: string;
  microsoftOAuthButton?: string;
  githubOAuthButton?: string;
  linkedInOAuthButton?: string;
  facebookOAuthButton?: string;
  ssoButton?: string;
}

export interface IAuthConfig {
  actionUrl: string; //I have made it compulsory here so that at least one url for lgin or register is available
  mode: AuthMode;
  authType: AuthType;
  users: IUser[];
  storageStatePath: string;
  successUrl?: string;
  authPageLayout?: AuthPageLayout;
  otpConfig?: IOTPConfig;
  google_oauth_callback?: string;

  oauthProvider?: OAuthProvider;
  oidcProvider?: OIDCProvider;
  samlProvider?: SAMLProvider;

  rateLimited?: boolean;
  maxAuthRetries?: number;
  customStrategy?: IAuthStrategy; // extension point for otehr custom startegies
  isApi?: boolean;
  apiConfig?: IAPIAuthConfig;
  BASE_SERVER_URL: string;
  selectors: AuthOverrideSelectors;
  deleteAuthStorageOnTestRun?: boolean;
  allowReauth?: boolean;
  tokenCookieName?: "session" | "jwt" | "access_token";
  OAUTHProviderPatterns?: Record<OAuthProvider, string>;
  OIDCProviderPatterns?: Record<OIDCProvider, string>;
  strategyLoggerActive?: boolean;

  tokenStorageConfig?: TokenStorageConfig;
  oidcConfig?: IOIDCConfig;
}

export interface IAPIFieldMap {
  username?: string;
  password?: string;
}

export interface IAPIAuthConfig {
  path: string;
  fieldMap?: IAPIFieldMap;
  additionalFields?: Record<string, unknown>;
  headers?: Record<string, string>;
  tokenPath?: string;
  tokenType?: TokenType;
  tokenHeaderName?: string;
}

export interface AuthSession {
  cookies?: any[];
  accessToken?: string;
  refreshToken?: string;
}

export interface LocalStorageTokenConfig {
  localStorageKey: string;
  tokenPath?: string;
}

export interface StorageStateMetadata {
  [key: string]: unknown;
}

export interface EnrichedStorageState {
  cookies: unknown[];
  origins: unknown[];
  sessionStorage?: Record<string, Record<string, string>>;
  metadata: StorageStateMetadata;
}

export interface BaseFixtures {
  authManager: AuthManager;
  authConfig: IAuthConfig;
  getUserConfig: (username: string) => IAuthConfig;
  getContext: (
    username: string,
    config?: IAuthConfig,
  ) => Promise<BrowserContext>;
}

export type TokenStorageType = "localStorage" | "sessionStorage";

export interface TokenStorageConfig {
  // Which browser storage the app puts the token in.
  storageType: TokenStorageType;

  // The key used in localStorage/sessionStorage.
  // e.g. "user", "app_user", "auth"
  storageKey: string;

  // Dot-notation path into the parsed JSON value to reach the token.
  // e.g. "accessToken", "auth.accessToken", "data.token"
  // Leave undefined if the stored value IS the token string directly.
  tokenPath?: string;

  // The origin the storage entry lives under.
  // Must exactly match the app's origin: "https://staging-worknobs.netlify.app"
  // Defaults to BASE_SERVER_URL if not set.
  origin?: string;

  // Header name to inject the token into for API requests.
  // Defaults to "Authorization".
  headerName?: string;

  // When true, prepends "Bearer " to the token value.
  // Only applies when headerName is "Authorization" or not set.
  // Defaults to true.
  attachBearer?: boolean;
}

export type PWBrowser = Browser;
export type PWContext = BrowserContext;
export type PWPage = Page;
export type PWLocator = Locator;
