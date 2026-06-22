import axios from "axios";
import { PWPage } from "../types";
import { AuthSession, IOTPConfig, IOTPRequestConfig, IUser } from "../types";
import { CookieJar } from "tough-cookie";

export class OTPResolver {
  private capturedOTP: string | null = null;

  private jar = new CookieJar();
  private client = axios.create({
    withCredentials: true,
  });

  constructor(private config: IOTPConfig) {}

  private async attachCookies(url: string, headers: any = {}) {
    const cookieString = await this.jar.getCookieString(url);
    if (cookieString) {
      headers["Cookie"] = cookieString;
    }
    return headers;
  }

  private async storeCookies(url: string, response: any) {
    const setCookie = response.headers?.["set-cookie"];
    if (!setCookie) return;

    for (const cookie of setCookie) {
      await this.jar.setCookie(cookie, url);
    }
  }

  async interceptOTP(page: PWPage): Promise<void> {
    const pattern = this.config.interceptPattern ?? "**/api/send-otp**";

    await page.route(pattern, async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      this.capturedOTP = body.otp ?? body.code ?? body.token ?? null;

      await route.fulfill({ response });
    });
  }

  async resolve(user?: IUser): Promise<string> {
    if (this.config.source === "env") {
      const key = this.config.envKey ?? "TEST_OTP";
      const otp = process.env[key];

      if (!otp) {
        throw new Error(`OTP env key "${key}" is not set`);
      }

      return otp;
    }

    if (
      user?.otpConfig?.source === "api-intercept" ||
      this.config.source === "api-intercept"
    ) {
      const deadline = Date.now() + 10_000;

      while (!this.capturedOTP) {
        if (Date.now() > deadline) {
          throw new Error(
            `OTP not captured within 10s. Check interceptPattern in otpConfig.`,
          );
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      return this.capturedOTP;
    }

    if (
      user?.otpConfig?.source === "api-request" ||
      this.config.source === "api-request"
    ) {
      return this.resolveViaRequest(user);
    }

    throw new Error(`OTP source "${this.config.source}" is not supported.`);
  }

  private async resolveViaRequest(user?: IUser): Promise<string> {
    const reqConfig =
      user?.otpConfig?.requestConfig || this.config?.requestConfig;

    if (!reqConfig) {
      throw new Error(
        `otpConfig.requestConfig is required when source is "api-request"`,
      );
    }

    const url = this.buildUrl(reqConfig, user);

    const queryParams = this.resolvePlaceholders(
      reqConfig.queryParams ?? {},
      user,
    );

    const body = this.resolvePlaceholders(
      (reqConfig.body as Record<string, string>) ?? {},
      user,
    );

    const headers = await this.attachCookies(url, reqConfig.headers ?? {});

    const response = await this.client({
      method: reqConfig.method ?? "GET",
      url,
      params: Object.keys(queryParams).length ? queryParams : undefined,
      data: reqConfig.method === "POST" ? body : undefined,
      headers,
    });

    await this.storeCookies(url, response);

    const otp = this.extractFromPath(
      response.data,
      reqConfig.responsePath ?? "otp",
    );

    if (!otp) {
      throw new Error(
        `Could not extract OTP from response at path "${
          reqConfig.responsePath ?? "otp"
        }". Response was: ${JSON.stringify(response.data)}`,
      );
    }

    return String(otp);
  }

  async handleOTPVerification(
    user: IUser,
    otp: string,
  ): Promise<AuthSession | null> {
    const reqConfig = user?.otpConfig?.verifyConfig || this.config.verifyConfig;

    if (!reqConfig) {
      throw new Error(
        `otpConfig.verifyConfig is required when source is "api-request"`,
      );
    }

    const url = this.buildUrl(reqConfig, user, otp);

    const queryParams = this.resolvePlaceholders(
      reqConfig.queryParams ?? {},
      user,
    );

    const body = this.resolvePlaceholders(
      (reqConfig.body as Record<string, string>) ?? {},
      user,
      otp,
    );

    const headers = await this.attachCookies(url, reqConfig.headers ?? {});

    const response = await this.client({
      method: reqConfig.method ?? "GET",
      url,
      params: Object.keys(queryParams).length ? queryParams : undefined,
      data: reqConfig.method === "POST" ? body : undefined,
      headers,
    });

    await this.storeCookies(url, response);

    if (response.status !== 200) {
      throw new Error(
        `API auth failed: ${response.status} ${response.statusText} : ${url}`,
      );
    }

    const accessToken: string = this.extractFromPath(
      response.data,
      reqConfig.accessTokenPath ?? "accessToken",
    ) as string;

    const refreshToken: string = this.extractFromPath(
      response.data,
      reqConfig.refreshTokenPath ?? "refreshToken",
    ) as string;

    const cookies = await this.extractCookies();

    if (!accessToken && !cookies?.length) {
      throw new Error(
        "Could not build a proper AuthSession without 'Access Token' & 'Cookies'",
      );
    }

    return {
      cookies,
      accessToken,
      refreshToken,
    };
  }

  private buildUrl(
    reqConfig: IOTPRequestConfig,
    user?: IUser,
    otp?: string,
  ): string {
    let resolvedPath = reqConfig.path;

    if (user) {
      resolvedPath = this.replacePlaceholder(
        resolvedPath,
        "username",
        user.username,
      );

      resolvedPath = this.replacePlaceholder(
        resolvedPath,
        "userId",
        user.username,
      );
    }

    if (otp) {
      resolvedPath = this.replacePlaceholder(resolvedPath, "otp", otp);
    }

    return `${reqConfig.baseUrl}${resolvedPath}`;
  }

  private resolvePlaceholders(
    params: Record<string, string>,
    user?: IUser,
    otp?: string,
  ): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      let resolvedValue = value;

      if (user) {
        resolvedValue = this.replacePlaceholder(
          resolvedValue,
          "username",
          user.username,
        );

        resolvedValue = this.replacePlaceholder(
          resolvedValue,
          "userId",
          user.username,
        );
      }

      if (otp) {
        resolvedValue = this.replacePlaceholder(resolvedValue, "otp", otp);
      }

      resolved[key] = resolvedValue;
    }

    return resolved;
  }

  private replacePlaceholder(
    template: string,
    placeholder: string,
    value: string,
  ): string {
    return template.replace(new RegExp(`{${placeholder}}`, "g"), value ?? "");
  }

  private extractFromPath(data: unknown, dotPath: string): unknown {
    return dotPath.split(".").reduce((acc: unknown, key: string) => {
      if (acc && typeof acc === "object") {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, data);
  }

  private async extractCookies() {
    const baseUrl = this.config.verifyConfig?.baseUrl;
    if (!baseUrl) return [];

    return this.jar.getCookies(baseUrl);
  }
}
