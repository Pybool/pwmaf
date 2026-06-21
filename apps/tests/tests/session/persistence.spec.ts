/**
 * persistence.spec.ts — Session file shape and metadata (§10 + [TEST]7)
 *
 * Verifies that every session file produced by global-setup is:
 *   - valid JSON with the standard Playwright { cookies, origins } shape
 *   - enriched with a { metadata } block (PWMAF extension)
 *   - written with a recent, valid ISO 8601 savedAt timestamp
 *   - carrying strategy-specific metadata fields (tokenType, otpSource, etc.)
 *
 * Covered user sets: allUsers (browser sessions) + allApiUsers (API sessions).
 * Tests run after global-setup — they read files, not re-authenticate.
 */

import fs from "fs";
import { test, expect } from "qa-pwmaf";
import { authFile, IUser } from "qa-pwmaf";
import rawUsers from "../data/users.json";
import rawApiUsers from "../data/users.api.json";

const allUsers = rawUsers as IUser[];
const allApiUsers = rawApiUsers as IUser[];

function assertFileShape(filePath: string, user: IUser) {
  expect(fs.existsSync(filePath), `Missing: ${filePath}`).toBe(true);

  const raw = fs.readFileSync(filePath, "utf-8");
  let parsed: any;
  expect(() => { parsed = JSON.parse(raw); }, "Must be valid JSON").not.toThrow();

  expect(Array.isArray(parsed.cookies), "cookies must be an array").toBe(true);
  expect(Array.isArray(parsed.origins), "origins must be an array").toBe(true);
  expect(parsed.metadata, "metadata block must exist").toBeTruthy();
  expect(parsed.metadata.username).toBe(user.username);
  expect(parsed.metadata.authType).toBe(user.authType);

  const savedAt = new Date(parsed.metadata.savedAt as string);
  expect(isNaN(savedAt.getTime()), "savedAt must be a valid ISO date").toBe(false);
  expect(Date.now() - savedAt.getTime(), "savedAt must be within last 24h").toBeLessThan(24 * 60 * 60 * 1000);

  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser session files (allUsers)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("§10 Session persistence — browser session files", () => {
  for (const user of allUsers) {
    test(`[${user.authType}] ${user.username} — file exists and is well-formed`, () => {
      assertFileShape(authFile(user.username), user);
    });
  }

  test("bearer-user session file records tokenType: bearer", () => {
    const parsed = JSON.parse(fs.readFileSync(authFile("bearer-user@test.com"), "utf-8"));
    expect(parsed.metadata.tokenType).toBeDefined();
  });

  test("custom-header-user session file records tokenType: custom-header", () => {
    const parsed = JSON.parse(fs.readFileSync(authFile("header-user@test.com"), "utf-8"));
    expect(parsed.metadata.tokenType).toBeDefined();
  });

  test("OTP sessions (email-otp + email-password-otp) record otpSource in metadata", () => {
    const otpUsers = allUsers.filter(u =>
      ["email-otp", "email-password-otp"].includes(u.authType ?? ""),
    );
    for (const user of otpUsers) {
      const parsed = JSON.parse(fs.readFileSync(authFile(user.username), "utf-8"));
      expect(parsed.metadata.otpSource, `${user.username} missing otpSource`).toBeDefined();
    }
  });

  test("email-password-otp sessions record authPageLayout and otpMode in metadata", () => {
    const hybridUsers = allUsers.filter(u => u.authType === "email-password-otp");
    for (const user of hybridUsers) {
      const parsed = JSON.parse(fs.readFileSync(authFile(user.username), "utf-8"));
      expect(parsed.metadata.authPageLayout, `${user.username} missing authPageLayout`).toBeDefined();
      expect(parsed.metadata.otpMode, `${user.username} missing otpMode`).toBeDefined();
    }
  });
});