import {
  AuthOverrideSelectors,
  OAuthProvider,
  otpStrategy,
  PWLocator,
  PWPage,
} from "../types";

const DEFAULTS: Required<AuthOverrideSelectors> = {
  emailOrUsernameField: "[data-testid='email']",
  passwordField: "[data-testid='password']",
  otpHiddenField: "input[autocomplete='one-time-code']",
  otpSingleField: "[data-testid='otp']",
  otpMultiFields: "[data-testid='otp-field']",
  emailSubmitButton: "button[type='submit']",
  passwordSubmitButton: "button[type='submit']",
  otpSubmitButton: "button[id='submit-btn']",
  googleOAuthButton: "button:has-text('Continue with Google')",
  microsoftOAuthButton: "button:has-text('Continue with Microsoft')",
  githubOAuthButton: "button:has-text('Continue with Github')",
  linkedInOAuthButton: "button:has-text('Continue with LinkedIn')",
  facebookOAuthButton: "button:has-text('Continue with Facebook')",
  ssoButton: "#sso-btn",
};

export class AuthPage {
  constructor(
    private page: PWPage,
    private overrides: AuthOverrideSelectors = {},
  ) {}

  private sel(key: keyof AuthOverrideSelectors): string {
    return this.overrides[key]?.trim() || DEFAULTS[key];
  }

  emailOrUsernameField(): PWLocator {
    return this.page.locator(this.sel("emailOrUsernameField"));
  }

  passwordField(): PWLocator {
    return this.page.locator(this.sel("passwordField"));
  }

  otpSingleField(strategy: otpStrategy = "single-input"): PWLocator {
    if (strategy === "hidden-input") {
      return this.page.locator(this.sel("otpHiddenField"));
    }
    return this.page.locator(this.sel("otpSingleField"));
  }

  otpMultiFields(): PWLocator {
    return this.page.locator(this.sel("otpMultiFields"));
  }

  emailSubmitButton(): PWLocator {
    return this.page.locator(this.sel("emailSubmitButton"));
  }

  passwordSubmitButton(): PWLocator {
    return this.page.locator(this.sel("passwordSubmitButton"));
  }

  otpSubmitButton(): PWLocator {
    return this.page.locator(this.sel("otpSubmitButton"));
  }

  oauthButton(provider: OAuthProvider): PWLocator {
    return this.page.locator(
      this.sel(`${provider}OAuthButton` as keyof AuthOverrideSelectors),
    );
  }

  ssoButton(): PWLocator {
    return this.page.locator(this.sel("ssoButton"));
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailOrUsernameField().fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordField().fill(password);
  }

  async fillOTP(
    otp: string,
    strategy: otpStrategy = "single-input",
    fieldCount: number = 1
  ): Promise<void> {
    switch (strategy) {
      case "hidden-input": {
        const hidden = this.otpSingleField("hidden-input");
        await hidden.waitFor({ state: "attached" });
        await hidden.pressSequentially(otp, { delay: 50 });
        return;
      }

      case "multi-input": {
        return this.fillOTPMulti(otp, fieldCount);
      }

      case "single-input":
      default: {
        return this.fillOTPSingle(otp);
      }
    }
  }

  private async fillOTPSingle(otp: string): Promise<void> {
    await this.otpSingleField("single-input").fill(otp);
  }

  private async fillOTPMulti(
    otp: string,
    fieldCount: number = 6,
  ): Promise<void> {
    const digits = otp.split("").slice(0, fieldCount);
    const fields = this.otpMultiFields();

    for (let i = 0; i < digits.length; i++) {
      const input = fields.nth(i);

      await input.waitFor({ state: "visible" });
      await input.click();
      await input.fill(digits[i]);

      const nextInput = fields.nth(i + 1);

      const nextVisible =
        i + 1 < digits.length
          ? await nextInput.isVisible().catch(() => false)
          : false;

      if (nextVisible) {
        const isFocused = await nextInput.evaluate(
          (el) => el === document.activeElement,
        ).catch(() => false);

        if (!isFocused) {
          await input.press("Tab");
        }
      }
    }
  }

  async submitEmail(): Promise<void> {
    await this.emailSubmitButton().click();
  }

  async submitPassword(): Promise<void> {
    await this.passwordSubmitButton().click();
  }

  async submitOTP(): Promise<void> {
    await this.otpSubmitButton().click();
  }

  async waitForOTPInline(strategy: otpStrategy = "single-input"): Promise<void> {
    if (strategy === "multi-input") {
      await this.otpMultiFields().first().waitFor({ state: "visible" });
    } else {
      const state = strategy === "hidden-input" ? "attached" : "visible";
      await this.otpSingleField(strategy).waitFor({ state });
    }
  }

  async waitForOTPPage(urlPattern: string): Promise<void> {
    await this.page.waitForURL(urlPattern);
  }

  async waitForOTPMultiField(): Promise<void> {
    await this.otpMultiFields().first().waitFor({ state: "visible" });
  }
}