
import { PWBrowser, PWContext } from "../types";
import { AuthResult, IAuthStrategy } from "./IAuthStrategy";
import {
  AuthPageLayout,
  AuthSession,
  IAuthConfig,
  IUser,
  OTPMode,
} from "../types";
import { AuthPage } from "../pages/AuthPage";
import { OTPResolver } from "../core/OtpResolver";

export class EmailPasswordOTPStrategy implements IAuthStrategy {
  async authenticate(
  browser: PWBrowser,
  user: IUser,
  config: IAuthConfig,
): Promise<AuthResult> {
  const started = Date.now();

  const log = (step: string) => {
    if(!config.strategyLoggerActive) return;
    console.log(
      `[EmailPasswordOTP][${user.username}] ${step} (+${Date.now() - started}ms)`,
    );
  };

  try {
    log("START authenticate");

    if (!config.otpConfig) {
      throw new Error(
        "EmailPasswordOTPStrategy requires otpConfig to be defined in IAuthConfig",
      );
    }

    const otpConfig = config.otpConfig;
    const otpResolver = new OTPResolver(otpConfig);

    const loginUrl =
      user.actionUrl ?? config.actionUrl ?? "";

    log(`Resolved loginUrl: ${loginUrl}`);

 
    if (user.isApi || config.isApi) {
      log("Entering API auth path");

      const context = await this.authenticateViaAPI(
        browser,
        user,
        loginUrl,
        config,
      );

      log("API auth completed");

      const otp = await otpResolver.resolve(user);
      log(`OTP resolved (API): ${otp ? "YES" : "NO"}`);

      const session =
        await otpResolver.handleOTPVerification(
          user,
          otp,
        );

      log("OTP verification completed (API)");

      if (session) {
        await this.applySession(context, session);
        log("Session applied (API)");
      }

      log("AUTH SUCCESS (API)");

      return {
        context,
        metadata: {
          authType: "email-password-otp",
          authPath: "api",
          username: user.username,
          otpSource: otpConfig.source,
        },
      };
    }


    log("Entering browser auth path");

    const overrides = config.selectors;
    const successUrl =
      config.successUrl ?? "**/dashboard**";

    const authPageLayout =
      (user.authPageLayout ||
        config.authPageLayout) ??
      "single-page";

    log(`authPageLayout: ${authPageLayout}`);
    log(`successUrl: ${successUrl}`);

    const context = await browser.newContext();
    log("Browser context created");

    const page = await context.newPage();
    log("Page created");

    const authPage = new AuthPage(
      page,
      overrides,
    );

    if (otpConfig.source === "api-intercept") {
      log("Starting OTP interception");

      await otpResolver.interceptOTP(page);

      log("OTP interception ready");
    }

    log(`Navigating to login page: ${loginUrl}`);

    await page.goto(loginUrl);

    log("Navigation complete");

    if (authPageLayout === "single-page") {
      log("Single-page login flow");

      await authPage.fillEmail(user.username);
      log("Email filled");

      await authPage.fillPassword(
        user.password!,
      );
      log("Password filled");

      await authPage.submitPassword();
      log("Password submitted");
    } else {
      log("Multi-step login flow");

      await authPage.fillEmail(user.username);
      log("Email filled");

      await authPage.submitEmail();
      log("Email submitted");

      log("Waiting for password field");

      await authPage
        .passwordField()
        .waitFor({ state: "visible" });

      log("Password field visible");

      await authPage.fillPassword(
        user.password!,
      );
      log("Password filled");

      await authPage.submitPassword();
      log("Password submitted");
    }

    log(
      `Waiting for OTP (${otpConfig.mode})`,
    );

    await this.waitForOTPByMode(
      authPage,
      otpConfig.mode,
      authPageLayout,
      otpConfig.otpPageUrl,
    );

    log("OTP screen detected");

    const otp = await otpResolver.resolve(user);
    log(`OTP resolved: ${otp}`);

    if (otpConfig.mode === "segmented") {
      log("Filling segmented OTP");

      await authPage.fillOTPMulti(
        otp,
        otpConfig.fieldCount ?? 6,
      );

      log("Segmented OTP filled");
    } else {
      log("Filling single OTP");

      await authPage.fillOTPSingle(otp);

      log("Single OTP filled");
    }

    if (!otpConfig.autoSubmit) {
      log("Submitting OTP");

      await authPage.submitOTP();

      log("OTP submitted");
    } else {
      log("Auto-submit enabled");
    }

    
    log(`Waiting for success URL: ${successUrl}`);

    await page.waitForURL(successUrl);

    log("SUCCESS URL reached");

    log("AUTH SUCCESS (BROWSER)");

    return {
      context,
      metadata: {
        authType: "email-password-otp",
        authPath: "browser",
        authPageLayout,
        otpMode: otpConfig.mode,
        otpSource: otpConfig.source,
        username: user.username,
      },
    };
  } catch (error) {
    console.error(
      `[EmailPasswordOTP][${user.username}] FAILED (+${Date.now() - started}ms)`,
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
    // User llevel apiConfig takes priority over the base config.
    const apiConfig = user.apiConfig ?? config.apiConfig ?? { path: "" };
    const fieldMap = apiConfig.fieldMap ?? {};
    const url = `${baseUrl}${apiConfig.path}`;

    const body: Record<string, unknown> = {
      [fieldMap.username ?? "username"]: user.username,
      [fieldMap.password ?? "password"]: user.password,
      ...apiConfig.additionalFields,
    };

    const context = await browser.newContext();
    const response = await context.request.post(url, {
      data: body,
      headers: apiConfig.headers ?? {},
    });

    if (!response.ok()) {
      throw new Error(
        `API auth failed: ${response.status()} ${response.statusText()} : ${url}`,
      );
    }

    return context;
  }

  private async waitForOTPByMode(
    authPage: AuthPage,
    mode: OTPMode,
    authPageLayout: AuthPageLayout,
    otpPageUrl?: string,
  ): Promise<void> {
    if (authPageLayout === "redirect-to-new-page") {
      await authPage.waitForOTPPage(otpPageUrl ?? "**/otp**");
    }

    if (mode === "segmented") {
      await authPage.waitForOTPMultiField();
    } else {
      await authPage.waitForOTPInline();
    }
  }

  private async applySession(
    context: PWContext,
    session: AuthSession,
  ): Promise<void> {
    if (session.cookies?.length) {
      await context.addCookies(
        session.cookies.map((cookie) => ({
          name: cookie.key,
          value: cookie.value,
          domain: cookie.domain ?? "",
          path: cookie.path ?? "/",
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: "Lax" as const,
        })),
      );
    }

    if (session.accessToken) {
      await context.setExtraHTTPHeaders({
        Authorization: `Bearer ${session.accessToken}`,
      });
    }
  }
}