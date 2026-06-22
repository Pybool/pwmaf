import { AuthResult, IAuthStrategy } from "./IAuthStrategy";
import { IAuthConfig, IUser, PWBrowser, PWContext } from "../types";
import { AuthPage } from "../pages/AuthPage";
import { buildApiUrl } from "../utils/helpers";

export class EmailPasswordStrategy implements IAuthStrategy {
  async authenticate(
    browser: PWBrowser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult> {
    const started = Date.now();

    const log = (step: string) => {
      if (!config.strategyLoggerActive) return;
      console.log(
        `[EmailPassword][${user.username}] ${step} (+${Date.now() - started}ms)`,
      );
    };

    try {
      log("START authenticate");

      const authUrl = user?.actionUrl?.trim() ?? config.actionUrl ?? "";

      const successUrl = config.successUrl ?? "**/dashboard**";

      const authPageLayout =
        (user.authPageLayout || config.authPageLayout) ?? "single-page";

      log(`authUrl: ${authUrl}`);
      log(`successUrl: ${successUrl}`);
      log(`layout: ${authPageLayout}`);

      if (user.isApi || config.isApi) {
        log("ENTER API AUTH PATH");

        const context = await this.authenticateViaAPI(
          browser,
          user,
          authUrl,
          config,
        );

        log("API request completed");

        return {
          context,
          metadata: {
            authType: "email-password",
            authPath: "api",
            username: user.username,
            tokenType:
              (user.apiConfig ?? config.apiConfig)?.tokenType ?? "cookie",
          },
        };
      }

      if (!user?.password) {
        throw new Error("Password is required for EmailPassword Strategy");
      }

      log("Password validated");

      const context = await browser.newContext();

      log("Browser context created");

      const page = await context.newPage();

      log("Page created");

      const authPage = new AuthPage(page, config.selectors);

      log(`Navigating → ${authUrl}`);

      await page.goto(authUrl);

      log("Navigation complete");

      if (authPageLayout === "single-page") {
        log("Single-page login flow");

        await authPage.fillEmail(user.username);
        log("Email filled");

        await authPage.fillPassword(user.password!);
        log("Password filled");

        await authPage.submitPassword();
        log("Password submitted");
      } else if (authPageLayout === "progressive-reveal") {
        log("Progressive reveal login flow");

        await authPage.fillEmail(user.username);
        log("Email filled");

        await authPage.submitEmail();
        log("Email submitted");

        log("Waiting for password field");

        await authPage.passwordField().waitFor({
          state: "visible",
        });

        log("Password field visible");

        await authPage.fillPassword(user.password!);

        log("Password filled");

        await authPage.submitPassword();

        log("Password submitted");
      }

      if (authPageLayout === "redirect-to-new-page") {
        throw new Error(
          "redirect-to-new-page is Unsupported for email password",
        );
      }

      log(`Waiting for URL: ${successUrl}`);

      await page.waitForURL(successUrl);

      log("SUCCESS URL reached");

      log("AUTH SUCCESS (BROWSER)");

      return {
        context,
        metadata: {
          authType: "email-password",
          authPath: "browser",
          username: user.username,
          tokenType: config.apiConfig?.tokenType ?? "cookie",
        },
      };
    } catch (error) {
      console.error(
        `[EmailPassword][${user.username}] FAILED (+${Date.now() - started}ms)`,
        error,
      );

      throw error;
    }
  }

  private async authenticateViaAPI(
    browser: PWBrowser,
    user: IUser,
    baseUrl: string,
    config: IAuthConfig,
  ): Promise<PWContext> {
    const started = Date.now();

    const log = (step: string) => {
      console.log(
        `[EmailPassword-API][${user.username}] ${step} (+${Date.now() - started}ms)`,
      );
    };

    log("START API auth");

    const apiConfig = user.apiConfig ?? config.apiConfig ?? { path: "" };

    const fieldMap = apiConfig.fieldMap ?? {};

    const url = buildApiUrl(baseUrl, apiConfig.path);

    log(`POST ${url}`);

    const body: Record<string, unknown> = {
      [fieldMap.username ?? "username"]: user.username,
      [fieldMap.password ?? "password"]: user.password,
      ...apiConfig.additionalFields,
    };

    log(`Request body prepared`);

    const context = await browser.newContext();

    const response = await context.request.post(url, {
      data: body,
      headers: apiConfig.headers ?? {},
    });

    log(`Response received (${response.status()})`);

    if (!response.ok()) {
      throw new Error(
        `API auth failed: ${response.status()} ${response.statusText()} : ${url}`,
      );
    }

    const tokenType = apiConfig.tokenType ?? "cookie";

    log(`tokenType: ${tokenType}`);

    if (tokenType === "cookie") {
      log("COOKIE MODE - returning context");
      return context;
    }

    const responseBody = await response.json();

    const tokenPath = apiConfig.tokenPath ?? "token";

    const token = this.extractFromPath(responseBody, tokenPath);

    log(`Token extracted: ${token ? "YES" : "NO"}`);

    if (!token) {
      throw new Error(
        `Could not extract token at path "${tokenPath}". Response: ${JSON.stringify(responseBody)}`,
      );
    }

    if (tokenType === "bearer") {
      log("Setting Bearer token header");

      await context.setExtraHTTPHeaders({
        Authorization: `Bearer ${String(token)}`,
      });
    } else if (tokenType === "custom-header") {
      if (!apiConfig.tokenHeaderName) {
        throw new Error(
          `tokenHeaderName is required when tokenType is "custom-header"`,
        );
      }

      log(`Setting custom header: ${apiConfig.tokenHeaderName}`);

      await context.setExtraHTTPHeaders({
        [apiConfig.tokenHeaderName]: String(token),
      });
    }

    log("API AUTH SUCCESS");

    return context;
  }

  private extractFromPath(data: unknown, dotPath: string): unknown {
    return dotPath.split(".").reduce((acc: unknown, key: string) => {
      if (acc && typeof acc === "object") {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, data);
  }
}
