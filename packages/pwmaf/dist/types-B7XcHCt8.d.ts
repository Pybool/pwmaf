import { Browser, BrowserContext, Page, Locator } from '@playwright/test';

interface AuthResult {
    context: PWContext;
    metadata?: StorageStateMetadata;
}
interface IAuthStrategy {
    authenticate(browser: PWBrowser, user: IUser, config: IAuthConfig): Promise<AuthResult>;
}

declare class AuthManager {
    private config;
    private factory;
    private browser;
    private userContexts;
    constructor(config: IAuthConfig);
    private buildEffectiveConfig;
    private authenticateWithRetry;
    private authenticateUser;
    setup(browser: PWBrowser): Promise<void>;
    reauthenticateUser(username: string, browser: PWBrowser): Promise<PWContext>;
    getContext(username: string, browser: PWBrowser): Promise<PWContext>;
    get authConfig(): IAuthConfig;
    getUserEffectiveConfig(username: string): IAuthConfig;
    readSession(username: string): Promise<EnrichedStorageState | null>;
    logoutSession(username: string): Promise<void>;
    teardown(): Promise<void>;
}

type AuthMode = "single" | "multi";
type AuthType = "email-password" | "email-otp" | "email-password-otp" | "oauth" | "oidc" | "saml" | "custom";
type OAuthProvider = "google" | "github" | "microsoft" | "facebook";
type OIDCProvider = "okta" | "auth0" | "azure-ad" | "keycloak" | "cognito" | "ping";
type SAMLProvider = "okta" | "azure" | "onelogin" | "ping" | "adfs";
type StorageState = {
    cookies: {
        name: string;
        value: string;
    }[];
};
type UserRole = "admin" | "user" | "guest";
type EmailAuthMode = "email-then-password" | "email-only";
type AuthPageLayout = "single-page" | "progressive-reveal" | "redirect-to-new-page";
type OTPMode = "single-input" | "segmented";
type OTPSource = "env" | "api-intercept" | "api-request";
type OTPRequestMethod = "GET" | "POST";
type OTPVerificationMethod = "GET" | "POST";
type OtpDeliveryChannel = "email" | "sms" | "authenticator-app";
type TokenType = "bearer" | "cookie" | "custom-header";
type otpStrategy = "single-input" | "hidden-input" | "multi-input";
interface IOTPRequestConfig {
    baseUrl: string;
    path: string;
    method?: OTPRequestMethod;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: Record<string, unknown>;
    responsePath?: string;
}
interface IOTPVerificationConfig {
    baseUrl: string;
    path: string;
    method?: OTPVerificationMethod;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: Record<string, unknown>;
    accessTokenPath?: string;
    refreshTokenPath?: string;
}
interface IOTPConfig {
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
interface IUser {
    username: string;
    password?: string;
    role?: UserRole;
    authType?: AuthType;
    oauthProvider?: OAuthProvider;
    oidcProvider?: OIDCProvider;
    samlProvider?: SAMLProvider;
    authPageLayout?: AuthPageLayout;
    isApi?: boolean;
    otpConfig?: IOTPConfig;
    apiConfig?: IAPIAuthConfig;
    actionUrl?: string;
    tokenStorageConfig?: TokenStorageConfig;
}
interface AuthOverrideSelectors {
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
interface IAuthConfig {
    actionUrl: string;
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
    customStrategy?: IAuthStrategy;
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
}
interface IAPIFieldMap {
    username?: string;
    password?: string;
}
interface IAPIAuthConfig {
    path: string;
    fieldMap?: IAPIFieldMap;
    additionalFields?: Record<string, unknown>;
    headers?: Record<string, string>;
    tokenPath?: string;
    tokenType?: TokenType;
    tokenHeaderName?: string;
}
interface AuthSession {
    cookies?: any[];
    accessToken?: string;
    refreshToken?: string;
}
interface LocalStorageTokenConfig {
    localStorageKey: string;
    tokenPath?: string;
}
interface StorageStateMetadata {
    [key: string]: unknown;
}
interface EnrichedStorageState {
    cookies: unknown[];
    origins: unknown[];
    sessionStorage?: Record<string, Record<string, string>>;
    metadata: StorageStateMetadata;
}
interface BaseFixtures {
    authManager: AuthManager;
    authConfig: IAuthConfig;
    getUserConfig: (username: string) => IAuthConfig;
    getContext: (username: string, config?: IAuthConfig) => Promise<BrowserContext>;
}
type TokenStorageType = "localStorage" | "sessionStorage";
interface TokenStorageConfig {
    storageType: TokenStorageType;
    storageKey: string;
    tokenPath?: string;
    origin?: string;
    headerName?: string;
    attachBearer?: boolean;
}
type PWBrowser = Browser;
type PWContext = BrowserContext;
type PWPage = Page;
type PWLocator = Locator;

export { type AuthResult as A, type BaseFixtures as B, type TokenStorageType as C, type TokenType as D, type EnrichedStorageState as E, type IAuthConfig as I, type LocalStorageTokenConfig as L, type OAuthProvider as O, type PWBrowser as P, type StorageStateMetadata as S, type TokenStorageConfig as T, type UserRole as U, type IAuthStrategy as a, type IUser as b, type PWPage as c, type AuthOverrideSelectors as d, type PWLocator as e, AuthManager as f, type PWContext as g, type StorageState as h, type AuthMode as i, type AuthPageLayout as j, type AuthSession as k, type AuthType as l, type EmailAuthMode as m, type IAPIAuthConfig as n, type otpStrategy as o, type IAPIFieldMap as p, type IOTPConfig as q, type IOTPRequestConfig as r, type IOTPVerificationConfig as s, type OIDCProvider as t, type OTPMode as u, type OTPRequestMethod as v, type OTPSource as w, type OTPVerificationMethod as x, type OtpDeliveryChannel as y, type SAMLProvider as z };
