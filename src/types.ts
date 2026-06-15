import { IAuthStrategy } from "./strategeies/IAuthStrategy";

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
export type OIDCProvider = "okta" | "auth0" | "azure-ad" | "keycloak" | "cognito" | "ping";

export type SAMLProvider =
  | "okta"
  | "azure"
  | "onelogin"
  | "ping"
  | "adfs";

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

  otpConfig?: IOTPConfig;
  apiConfig?: IAPIAuthConfig;
  actionUrl?: string; // I have done this becos not all users may have to login/register to the same url,this will overide the actionUrl inn IAuthConfig

  
}

export interface AuthOverrideSelectors {
  emailOrUsernameField?: string;
  passwordField?: string;
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
  ssoButton?: string
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
  OIDCProviderPatterns?: Record<OIDCProvider, string>;
  strategyLoggerActive?: boolean;
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


export interface StorageStateMetadata {
  [key: string]: unknown;
}

export interface EnrichedStorageState {
  cookies: unknown[];
  origins: unknown[];
  metadata: StorageStateMetadata;
}