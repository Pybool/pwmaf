import { AuthResult, IAuthStrategy } from "./IAuthStrategy";
import {
  AuthPageLayout,
  AuthSession,
  IAuthConfig,
  IUser,
  OTPMode,
  PWBrowser,
  PWContext,
} from "../types";
import { AuthPage } from "../pages/AuthPage";
import { OTPResolver } from "../core/OtpResolver";

export class EmailOTPStrategy implements IAuthStrategy {
  async authenticate(
    browser: PWBrowser,
    user: IUser,
    config: IAuthConfig,
  ): Promise<AuthResult> {
    const started = Date.now();

    const log = (step: string) => {
      if (!config.strategyLoggerActive) return;
      console.log(
        `[EmailOTPStrategy][${user.username}] ${step} (+${Date.now() - started}ms)`,
      );
    };

    try {
      log("START authenticate");

      const authUrl = user.actionUrl ?? config.actionUrl ?? "";

      if (!config.otpConfig) {
        throw new Error(
          `EmailOTPStrategy requires otpConfig to be defined in IAuthConfig`,
        );
      }

      log("Loaded config");

      const otpConfig = config.otpConfig;
      const otpResolver = new OTPResolver(otpConfig);

      if (user.isApi || config.isApi) {
        log("Entering API auth path");

        const context = await browser.newContext();
        log("Created browser context");

        const otp = await otpResolver.resolve(user);
        log(`Resolved OTP: ${otp ? "SUCCESS" : "EMPTY"}`);

        const session = await otpResolver.handleOTPVerification(user, otp);

        log("OTP verification completed");

        if (session) {
          await this.applySession(context, session);
          log("Applied session");
        }

        log("AUTH SUCCESS (API)");

        return {
          context,
          metadata: {
            authType: "email-otp",
            authPath: "api",
            username: user.username,
            otpSource: otpConfig.source,
          },
        };
      }

      log("Entering browser auth path");

      const successUrl = config.successUrl ?? "**/dashboard**";

      const authPageLayout =
        (user.authPageLayout || config.authPageLayout) ?? "single-page";

      const context = await browser.newContext();
      log("Created browser context");

      const page = await context.newPage();
      log("Created page");

      const authPage = new AuthPage(page, config.selectors);

      if (otpConfig.source === "api-intercept") {
        log("Starting OTP interception");

        await otpResolver.interceptOTP(page);

        log("OTP interception ready");
      }

      log(`Navigating => ${authUrl}`);

      await page.goto(authUrl);

      log("Navigation completed");

      await authPage.fillEmail(user.username);

      log("Email filled");

      await authPage.submitEmail();

      log("Email submitted");

      log(`Waiting for OTP screen (${otpConfig.mode})`);

      await this.waitForOTPByMode(
        authPage,
        otpConfig.mode,
        authPageLayout,
        otpConfig.otpPageUrl,
      );

      log("OTP screen detected");
      const otp = await otpResolver.resolve(user);
      log(`OTP resolved => ${otp}`);

      if (otpConfig.mode === "segmented") {
        log("Filling segmented OTP");

        await authPage.fillOTP(
          otp,
          otpConfig.strategy,
          otpConfig.fieldCount ?? 6,
        );

        log("Segmented OTP filled");
      } else if (otpConfig.mode === "single-input") {
        log("Filling single OTP");
        await authPage.fillOTP(otp);
        log("Single OTP filled");
      }

      if (!otpConfig.autoSubmit) {
        log("Submitting OTP");
        await authPage.submitOTP();
        log("OTP submitted");
      }

      log(`Waiting for success URL => ${successUrl}`);
      await page.waitForURL(successUrl);
      log("Success URL reached");

      log("AUTH SUCCESS (Browser)");

      return {
        context,
        metadata: {
          authType: "email-otp",
          authPath: "browser",
          username: user.username,
          otpSource: otpConfig.source,
        },
      };
    } catch (error) {
      console.error(
        `[EmailOTPStrategy][${user.username}] FAILED after ${Date.now() - started}ms`,
        error,
      );

      throw error;
    }
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
