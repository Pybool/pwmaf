import { a as IAuthStrategy, P as PWBrowser, b as IUser, I as IAuthConfig, A as AuthResult, c as PWPage, d as AuthOverrideSelectors, e as PWLocator, o as otpStrategy, O as OAuthProvider, E as EnrichedStorageState, f as AuthManager, g as PWContext, S as StorageStateMetadata, h as StorageState, T as TokenStorageConfig, B as BaseFixtures } from './types-B7XcHCt8.mjs';
export { i as AuthMode, j as AuthPageLayout, k as AuthSession, l as AuthType, m as EmailAuthMode, n as IAPIAuthConfig, p as IAPIFieldMap, q as IOTPConfig, r as IOTPRequestConfig, s as IOTPVerificationConfig, L as LocalStorageTokenConfig, t as OIDCProvider, u as OTPMode, v as OTPRequestMethod, w as OTPSource, x as OTPVerificationMethod, y as OtpDeliveryChannel, z as SAMLProvider, C as TokenStorageType, D as TokenType, U as UserRole } from './types-B7XcHCt8.mjs';
import { EventEmitter } from 'events';
export { C as ConfigValidationError, V as ValidationIssue, a as ValidationLevel, v as validateConfig } from './validate-config-BphwjBWm.mjs';
import * as _playwright_test from '@playwright/test';
export { expect } from '@playwright/test';

declare class EmailPasswordStrategy implements IAuthStrategy {
    authenticate(browser: PWBrowser, user: IUser, config: IAuthConfig): Promise<AuthResult>;
    private authenticateViaAPI;
    private extractFromPath;
}

declare class EmailOTPStrategy implements IAuthStrategy {
    authenticate(browser: PWBrowser, user: IUser, config: IAuthConfig): Promise<AuthResult>;
    private waitForOTPByMode;
    private applySession;
}

declare class EmailPasswordOTPStrategy implements IAuthStrategy {
    authenticate(browser: PWBrowser, user: IUser, config: IAuthConfig): Promise<AuthResult>;
    private authenticateViaAPI;
    private waitForOTPByMode;
    private applySession;
}

declare class OAuthStrategy implements IAuthStrategy {
    authenticate(browser: PWBrowser, user: IUser, config: IAuthConfig): Promise<AuthResult>;
}

declare class OIDCStrategy implements IAuthStrategy {
    authenticate(browser: PWBrowser, user: IUser, config: IAuthConfig): Promise<AuthResult>;
}

declare class SAMLStrategy implements IAuthStrategy {
    authenticate(browser: PWBrowser, user: IUser, config: IAuthConfig): Promise<AuthResult>;
}

declare class AuthPage {
    private page;
    private overrides;
    constructor(page: PWPage, overrides?: AuthOverrideSelectors);
    private sel;
    emailOrUsernameField(): PWLocator;
    passwordField(): PWLocator;
    otpSingleField(strategy?: otpStrategy): PWLocator;
    otpMultiFields(): PWLocator;
    emailSubmitButton(): PWLocator;
    passwordSubmitButton(): PWLocator;
    otpSubmitButton(): PWLocator;
    oauthButton(provider: OAuthProvider): PWLocator;
    ssoButton(): PWLocator;
    fillEmail(email: string): Promise<void>;
    fillPassword(password: string): Promise<void>;
    fillOTP(otp: string, strategy?: otpStrategy, fieldCount?: number): Promise<void>;
    private fillOTPSingle;
    private fillOTPMulti;
    submitEmail(): Promise<void>;
    submitPassword(): Promise<void>;
    submitOTP(): Promise<void>;
    waitForOTPInline(strategy?: otpStrategy): Promise<void>;
    waitForOTPPage(urlPattern: string): Promise<void>;
    waitForOTPMultiField(): Promise<void>;
}

type SessionSavedPayload = {
    filePath: string;
    enriched: EnrichedStorageState;
    userId?: string;
    authType?: string;
    savedAt: string;
};
type AuthEventMap = {
    "session:saved": [SessionSavedPayload];
    "session:failed": [{
        filePath: string;
        error: Error;
    }];
    "session:read": [{
        filePath: string;
        state: EnrichedStorageState;
    }];
    "session:deleted": [{
        filePath: string;
    }];
};
declare class AuthEventEmitter extends EventEmitter {
    emit<K extends keyof AuthEventMap>(event: K, ...args: AuthEventMap[K]): boolean;
    on<K extends keyof AuthEventMap>(event: K, listener: (...args: AuthEventMap[K]) => void): this;
    once<K extends keyof AuthEventMap>(event: K, listener: (...args: AuthEventMap[K]) => void): this;
    off<K extends keyof AuthEventMap>(event: K, listener: (...args: AuthEventMap[K]) => void): this;
}
declare const authEvents: AuthEventEmitter;

declare let authConfig: IAuthConfig;
declare function deleteAuthStore(folderPath: string): Promise<void>;
declare function getOrCreateAuthManager(): Promise<AuthManager>;

declare class AuthReporter {
    private logs;
    attach(): void;
    getLogs(): string[];
    clear(): void;
}

declare class AuthFactory {
    getStrategy(config: IAuthConfig): IAuthStrategy;
    createSession(browser: PWBrowser, user: IUser, strategy: IAuthStrategy, config: IAuthConfig): Promise<AuthResult>;
    saveSession(context: PWContext, filePath: string, metadata?: StorageStateMetadata): Promise<void>;
    readSession(filePath: string): EnrichedStorageState | null;
    restoreSessionStorage(context: PWContext, state: EnrichedStorageState): Promise<void>;
    deleteSession(filePath: string): void;
}

interface TokenExpiryConfig {
    cookieName?: string;
    metadataExpiresAt?: string;
}
declare function isTokenExpired(storage: StorageState & {
    metadata?: Record<string, unknown>;
}, opts?: TokenExpiryConfig): boolean;
declare function ensureValidSession(username: string, browser: PWBrowser): Promise<void>;
declare function buildApiUrl(baseUrl: string, path?: string): string;
declare function authFile(username: string): string;
declare function validateUserEndpoints(users: IUser[]): Promise<void>;

declare function extractToken(state: EnrichedStorageState, config: TokenStorageConfig, fallbackOrigin?: string): string | null;
declare function getTokenFromFile(username: string, storageStatePath: string, config: TokenStorageConfig, fallbackOrigin?: string): string | null;

declare const test: _playwright_test.TestType<_playwright_test.PlaywrightTestArgs & _playwright_test.PlaywrightTestOptions & BaseFixtures, _playwright_test.PlaywrightWorkerArgs & _playwright_test.PlaywrightWorkerOptions>;

export { type AuthEventMap, AuthFactory, AuthManager, AuthOverrideSelectors, AuthPage, AuthReporter, AuthResult, BaseFixtures, EmailOTPStrategy, EmailPasswordOTPStrategy, EmailPasswordStrategy, EnrichedStorageState, IAuthConfig, IAuthStrategy, IUser, OAuthProvider, OAuthStrategy, OIDCStrategy, PWBrowser, PWContext, PWLocator, PWPage, SAMLStrategy, type SessionSavedPayload, StorageState, StorageStateMetadata, type TokenExpiryConfig, TokenStorageConfig, authConfig, authEvents, authFile, buildApiUrl, deleteAuthStore, ensureValidSession, extractToken, getOrCreateAuthManager, getTokenFromFile, isTokenExpired, otpStrategy, test, validateUserEndpoints };
