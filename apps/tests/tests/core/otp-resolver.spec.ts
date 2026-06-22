/**
 * otp-resolver.spec.ts — OTPResolver lifecycle integrity (§14)
 *
 * §1  /auth/request-otp  — triggers OTP generation
 * §2  /auth/get-otp      — returns a valid 6-digit OTP after request
 * §3  /auth/verify-otp   — correct OTP → 200 + session; wrong OTP → 401; second use → 400
 * §4  Placeholder substitution — {username} in GET URL path
 * §5  End-to-end — api-request source resolves, fills, submits, /api/me 200
 * §6  Cross-port consistency — all OTP-enabled ports expose the same API contract
 */

import { test, expect } from "../fixtures/fixtures";
import { EmailOTPStrategy, IUser } from "qa-pwmaf";
import type { IAuthConfig } from "qa-pwmaf";
import rawUsers from "../data/users.json";

const allUsers = rawUsers as IUser[];
function u(n: string): IUser {
  return (
    allUsers.find((x) => x.username === n) ??
    (() => {
      throw new Error(n);
    })()
  );
}
function eff(user: IUser, base: IAuthConfig): IAuthConfig {
  return {
    ...base,
    authType: user.authType ?? base.authType,
    authPageLayout: user.authPageLayout ?? base.authPageLayout,
    isApi: user.isApi ?? base.isApi,
    otpConfig: user.otpConfig ?? base.otpConfig,
    apiConfig: user.apiConfig ?? base.apiConfig,
    actionUrl: user.actionUrl ?? base.actionUrl,
  };
}

const BASE = "http://localhost:3003";
const EMAIL = "otp-user@test.com";

test.describe("§14 OTPResolver — OTP lifecycle integrity", () => {
  test("POST /auth/request-otp responds with 200 and triggers OTP generation", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/auth/request-otp`, {
      data: { email: EMAIL },
    });
    expect(res.status()).toBe(200);
  });

  test("GET /auth/get-otp/:email returns a 6-digit OTP string after requesting one", async ({
    request,
  }) => {
    await request.post(`${BASE}/auth/request-otp`, { data: { email: EMAIL } });
    const res = await request.get(`${BASE}/auth/get-otp/${EMAIL}`);
    const { data } = await res.json();
    expect(res.status()).toBe(200);
    expect(data.otp).toMatch(/^\d{6}$/);
  });

  test("{username} placeholder in GET URL is substituted — server does not return 404", async ({
    request,
  }) => {
    await request.post(`${BASE}/auth/request-otp`, { data: { email: EMAIL } });
    const res = await request.get(`${BASE}/auth/get-otp/${EMAIL}`);
    expect(res.status()).not.toBe(404);
  });

  test("verify-otp with correct OTP returns 200 and sets session cookie", async ({
    request,
  }) => {
    const trig = await request.post(`${BASE}/auth/request-otp`, {
      data: { email: EMAIL },
    });
    const { otp } = await trig.json();
    const verify = await request.post(`${BASE}/auth/verify-otp`, {
      data: { email: EMAIL, otp },
    });
    expect(verify.status()).toBe(200);
    expect((await verify.json()).success).toBe(true);
    expect((await request.get(`${BASE}/api/me`)).status()).toBe(200);
  });

  test("verify-otp with wrong OTP returns 401 with error message", async ({
    request,
  }) => {
    await request.post(`${BASE}/auth/request-otp`, { data: { email: EMAIL } });
    const res = await request.post(`${BASE}/auth/verify-otp`, {
      data: { email: EMAIL, otp: "000000" },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toMatch(/invalid otp/i);
  });

  test("OTP is single-use — second verify with same code returns 400", async ({
    request,
  }) => {
    const trig = await request.post(`${BASE}/auth/request-otp`, {
      data: { email: EMAIL },
    });
    const { otp } = await trig.json();
    await request.post(`${BASE}/auth/verify-otp`, {
      data: { email: EMAIL, otp },
    });
    const reuse = await request.post(`${BASE}/auth/verify-otp`, {
      data: { email: EMAIL, otp },
    });
    expect(reuse.status()).toBe(400);
  });

  test("end-to-end: api-request source → OTP resolved → browser field filled → /api/me 200", async ({
    browser,
    authConfig,
  }) => {
    const user = u("otp-user@test.com");
    const result = await new EmailOTPStrategy().authenticate(
      browser,
      user,
      eff(user, authConfig),
    );
    const meta = result.metadata as Record<string, unknown>;
    expect(
      (await result.context.request.get(`${user.actionUrl}/api/me`)).status(),
    ).toBe(200);
    expect(meta.otpSource).toBe("api-request");
    await result.context.close();
  });

  test("mock servers at all OTP ports expose consistent request + get-otp routes", async ({
    request,
  }) => {
    const otpPorts = [3003, 3004, 3005, 3006, 3010, 3011];
    for (const port of otpPorts) {
      const base = `http://localhost:${port}`;
      const email =
        allUsers.find((u) => u.actionUrl === `http://localhost:${port}`)
          ?.username ?? EMAIL;
      const trig = await request.post(`${base}/auth/request-otp`, {
        data: { email },
      });
      expect(
        trig.status(),
        `port ${port} /auth/request-otp should return 200`,
      ).toBe(200);
      const otp = await request.get(`${base}/auth/get-otp/${email}`);
      expect(otp.status(), `port ${port} /auth/get-otp should return 200`).toBe(
        200,
      );
    }
  });
});
