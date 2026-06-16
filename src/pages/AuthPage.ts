import { AuthOverrideSelectors, OAuthProvider, PWLocator, PWPage } from "../types";

const DEFAULTS: Required<AuthOverrideSelectors> = {
  emailOrUsernameField: "[data-testid='email']",
  passwordField: "[data-testid='password']",
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
  ssoButton: "#sso-btn"
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

  otpSingleField(): PWLocator {
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
    return this.page.locator(this.sel(`${provider}OAuthButton`));
  }

  ssoButton() {
    return this.page.locator(this.sel("ssoButton"));
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailOrUsernameField().fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordField().fill(password);
  }

  async fillOTPSingle(otp: string): Promise<void> {
    await this.otpSingleField().fill(otp);
  }

  async fillOTPMulti(otp: string, fieldCount: number = 6): Promise<void> {
    const digits = otp.split("");
    const fields = this.otpMultiFields();
    for (let i = 0; i < fieldCount; i++) {
      await fields.nth(i).fill(digits[i] ?? "");
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

  async waitForOTPInline(): Promise<void> {
    await this.otpSingleField().waitFor({ state: "visible" });
  }

  async waitForOTPPage(urlPattern: string): Promise<void> {
    await this.page.waitForURL(urlPattern);
  }

  async waitForOTPMultiField(): Promise<void> {
    await this.otpMultiFields().first().waitFor({ state: "visible" });
  }
}
