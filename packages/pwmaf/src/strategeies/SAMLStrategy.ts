import { AuthResult, IAuthStrategy } from "./IAuthStrategy";
import { IAuthConfig, IUser, PWBrowser } from "../types";

export class SAMLStrategy implements IAuthStrategy {
  async authenticate(
    browser: PWBrowser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult> {
    const started = Date.now();

    const log = (step: string) => {
      if (!config.strategyLoggerActive) return;
      console.log(
        `[SAML][${user.username}] ${step} (+${Date.now() - started}ms)`,
      );
    };

    try {
      log("START SAML authenticate");

      const samlProvider = user.samlProvider ?? config.samlProvider;

      const serverBase =
        user.actionUrl ?? config.BASE_SERVER_URL ?? "http://localhost:3000";

      const successUrl = config.successUrl ?? "**/dashboard**";

      const loginUrl = `${serverBase}/auth/saml/login/${encodeURIComponent(user.username)}`;

      log(`provider: ${samlProvider}`);
      log(`serverBase: ${serverBase}`);
      log(`loginUrl: ${loginUrl}`);
      log(`successUrl: ${successUrl}`);

      const context = await browser.newContext();

      log("Browser context created");

      const page = await context.newPage();

      log("Page created");

      log(`Navigating → ${loginUrl}`);

      await page.goto(loginUrl);

      log("Login page loaded");

      log("Waiting for SAML redirect / callback");

      await page.waitForURL(successUrl);

      log("SUCCESS URL reached");

      log("AUTH SUCCESS (SAML)");

      return {
        context,
        metadata: {
          authType: "saml",
          provider: samlProvider ?? "unknown",
          mockServerUrl: serverBase,
          acsUrl: `${serverBase}/auth/saml/callback`,
          username: user.username,
        },
      };
    } catch (error) {
      console.error(
        `[SAML][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error,
      );

      throw error;
    }
  }
}
