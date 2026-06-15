import { Browser, BrowserContext } from "@playwright/test";
import { AuthResult, IAuthStrategy } from "./IAuthStrategy";
import { IAuthConfig, IUser, OAuthProvider } from "../types";
import { AuthPage } from "../pages/AuthPage";

const PROVIDER_PATTERNS: Record<string, string> = {
  google: "**/accounts.google.com/**",
  github: "**/github.com/login/oauth/**",
  microsoft: "**/login.microsoftonline.com/**/authorize**",
  gitlab: "**/gitlab.com/oauth/authorize**",
  facebook: "**/facebook.com/dialog/oauth**",
  linkedin: "**/linkedin.com/oauth/**",
  twitter: "**/twitter.com/i/oauth2/**",
  slack: "**/slack.com/oauth/**",
  okta: "**/*.okta.com/**",
  auth0: "**/*.auth0.com/**",
};

const FALLBACK_PATTERN = "**/{authorize,oauth/authorize,login/oauth}**";

function getInterceptPattern(provider?: string): string {
  if (!provider) return FALLBACK_PATTERN;
  return PROVIDER_PATTERNS[provider.toLowerCase()] ?? FALLBACK_PATTERN;
}

export class OAuthStrategy implements IAuthStrategy {
  async authenticate(
    browser: Browser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult> {
    const started = Date.now();

    const log = (step: string) => {
      if(!config.strategyLoggerActive) return;
      console.log(
        `[OAuth][${user.username}] ${step} (+${Date.now() - started}ms)`,
      );
    };

    try {
      log("START OAuth authenticate");

      

      const successUrl = config.successUrl ?? "**/dashboard**";

      const serverBase =
        user.actionUrl ?? config.BASE_SERVER_URL ?? "http://localhost:3009";

      const oauthProvider =
      user?.oauthProvider || (config?.oauthProvider as OAuthProvider);

      const loginUrl = (user.actionUrl ?? config.actionUrl ?? "") + `?provider=${oauthProvider}`;

      log(`loginUrl: ${loginUrl}`);
      log(`successUrl: ${successUrl}`);
      log(`provider: ${oauthProvider}`);
      log(`serverBase: ${serverBase}`);

      const context = await browser.newContext();

      log("Browser context created");

      const page = await context.newPage();

      log("Page created");

      const authPage = new AuthPage(page, config.selectors);

      // =========================
      // ROUTE INTERCEPTION
      // =========================
      const pattern = getInterceptPattern(oauthProvider);

      log(`Setting route interception: ${pattern}`);

      await context.route(pattern, async (route) => {
        log("Intercepted OAuth request → mocking callback");

        await route.fulfill({
          status: 302,
          headers: {
            location: `${serverBase}/auth/oauth/callback?code=mock-oauth-code&state=mock-state`,
          },
        });
      });

      log("Route interception active");

      // =========================
      // NAVIGATION
      // =========================
      log(`Navigating → ${loginUrl}`);

      await page.goto(loginUrl);

      log("Login page loaded");

      // =========================
      // UI INTERACTION
      // =========================
      log(`Waiting for OAuth button: ${oauthProvider}`);

      await authPage.oauthButton(oauthProvider).waitFor({
        state: "visible",
      });

      log("OAuth button visible");

      log("Clicking OAuth button");

      await authPage.oauthButton(oauthProvider).click();

      log("OAuth button clicked");

      // =========================
      // FINAL REDIRECT
      // =========================
      log(`Waiting for success URL → ${successUrl}`);

      await page.waitForURL(successUrl);

      log("SUCCESS URL reached");

      log("AUTH SUCCESS (OAuth)");

      return {
        context,
        metadata: {
          authType: "oauth",
          provider: oauthProvider ?? "unknown",
          mockServerUrl: serverBase,
          username: user.username,
        },
      };
    } catch (error) {
      console.error(
        `[OAuth][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error,
      );
      throw error;
    }
  }
}
