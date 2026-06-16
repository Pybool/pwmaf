import { AuthResult, IAuthStrategy } from "./IAuthStrategy";
import { IAuthConfig, IUser, OIDCProvider, PWBrowser } from "../types";
import { AuthPage } from "../pages/AuthPage";
import { authConfig } from "../core/AuthManagerInstance";

const OIDC_PROVIDER_PATTERNS: Record<OIDCProvider, string> =
  authConfig?.OIDCProviderPatterns || {
    okta: "**/*.okta.com/oauth2/**/authorize**",
    auth0: "**/*.auth0.com/authorize**",
    keycloak: "**/auth/realms/**/protocol/openid-connect/auth**",
    "azure-ad": "**/login.microsoftonline.com/**/oauth2/v2.0/authorize**",
    cognito: "**/*.auth.*.amazoncognito.com/oauth2/authorize**",
    ping: "**/*.pingidentity.com/as/authorization**",
  };

const OIDC_FALLBACK_PATTERN =
  "**/{authorize,connect/authorize,oauth2/authorize}**";

function getOIDCInterceptPattern(provider?: OIDCProvider): string {
  if (!provider) return OIDC_FALLBACK_PATTERN;

  return (
    OIDC_PROVIDER_PATTERNS[provider.toLowerCase() as OIDCProvider] ??
    OIDC_FALLBACK_PATTERN
  );
}

export class OIDCStrategy implements IAuthStrategy {
  async authenticate(
    browser: PWBrowser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult> {
    const started = Date.now();

    const log = (step: string) => {
      if(!config.strategyLoggerActive) return;
      console.log(
        `[OIDC][${user.username}] ${step} (+${Date.now() - started}ms)`,
      );
    };

    try {
      log("START OIDC authenticate");

      const loginUrl = user.actionUrl ?? config.actionUrl ?? "";

      const successUrl = config.successUrl ?? "**/dashboard**";

      const serverBase =
        user.actionUrl ?? config.BASE_SERVER_URL ?? "http://localhost:3019";

      const oidcProvider = user?.oidcProvider ?? config?.oidcProvider;

      log(`loginUrl: ${loginUrl}`);
      log(`successUrl: ${successUrl}`);
      log(`provider: ${oidcProvider}`);
      log(`serverBase: ${serverBase}`);

      const context = await browser.newContext();

      log("Browser context created");

      const page = await context.newPage();

      log("Page created");

      const authPage = new AuthPage(page, config.selectors);

      // =========================
      // ROUTE INTERCEPTION
      // =========================
      const pattern = getOIDCInterceptPattern(oidcProvider);

      log(`Setting OIDC route interception: ${pattern}`);

      await context.route(pattern, async (route) => {
        log("Intercepted OIDC authorize request → returning mock callback");

        await route.fulfill({
          status: 302,
          headers: {
            location: `${serverBase}/auth/oidc/callback?code=mock-oidc-code`,
          },
        });
      });

      log("Route interception active");

      // =========================
      // LOGIN FLOW
      // =========================
      log(`Navigating → ${loginUrl}`);

      await page.goto(loginUrl);

      log("Login page loaded");

      log("Clicking SSO button");

      await authPage.ssoButton().click();

      log("SSO button clicked");

      // =========================
      // FINAL REDIRECT
      // =========================
      log(`Waiting for success URL → ${successUrl}`);

      await page.waitForURL(successUrl);

      log("SUCCESS URL reached");

      log("AUTH SUCCESS (OIDC)");

      return {
        context,
        metadata: {
          authType: "oidc",
          provider: oidcProvider ?? "unknown",
          mockServerUrl: serverBase,
          username: user.username,
        },
      };
    } catch (error) {
      console.error(
        `[OIDC][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error,
      );
      throw error;
    }
  }
}
