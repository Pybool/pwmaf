#!/usr/bin/env node
/**
 * init.ts  (compiled to init.js, exposed as `npx pwmaf init`)
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive CLI that walks a QA through picking their auth setup and writes
 * ready-to-fly config files to disk.
 *
 * Usage:
 *   npx pwmaf init                        → interactive prompts
 *   npx pwmaf init --preset browser-email-password   → skip prompts, use preset
 *   npx pwmaf init --list-presets         → print all available presets
 *   npx pwmaf init --dry-run              → print config, don't write files
 *
 * No dependencies beyond Node built-ins — readline is used for prompts so
 * this works in any environment without installing enquirer/inquirer.
 */

import * as fs from "fs";
import * as path from "path";
import * as rl from "readline";

import {
  generateConfig,
  printGeneratedConfig,
  PRESETS,
  GeneratorInput,
  AuthType,
  OAuthProvider,
  OIDCProvider,
  SAMLProvider,
  OTPSource,
  OTPMode,
  TokenType,
  ConfigStyle,
} from "./config-generator";
import { logger } from "../utils/logger";
import { findProjectRoot } from "../utils/findProjectRoot";

// ─── Readline helpers

const iface = rl.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) =>
    iface.question(`\n${question} `, (ans) => resolve(ans.trim())),
  );
}

function askChoice<T extends string>(
  question: string,
  choices: T[],
  defaultValue: T,
): Promise<T> {
  const choiceStr = choices
    .map((c, i) => `  ${i + 1}. ${c}${c === defaultValue ? " (default)" : ""}`)
    .join("\n");
  return ask(`${question}\n${choiceStr}\n→`).then((ans) => {
    const num = parseInt(ans);
    if (!isNaN(num) && num >= 1 && num <= choices.length) {
      return choices[num - 1];
    }
    return defaultValue;
  });
}

function askYesNo(question: string, defaultValue: boolean): Promise<boolean> {
  const hint = defaultValue ? "[Y/n]" : "[y/N]";
  return ask(`${question} ${hint}`).then((ans) => {
    if (!ans) return defaultValue;
    return ans.toLowerCase().startsWith("y");
  });
}

// ─── CLI 

async function main() {
  const args = process.argv.slice(2);

  // ── --list-presets 
  if (args.includes("--list-presets")) {
    console.log("\nAvailable presets:\n");
    Object.keys(PRESETS).forEach((key) => {
      const p = PRESETS[key];
      console.log(
        `  ${key.padEnd(40)} authType: ${p.authType}, isApi: ${p.isApi}, style: ${p.configStyle}`,
      );
    });
    console.log("\nUsage: npx pwmaf init --preset <name>\n");
    process.exit(0);
  }

  // ── --preset <name> 
  const presetIdx = args.indexOf("--preset");
  if (presetIdx !== -1) {
    const presetName = args[presetIdx + 1];
    if (!presetName || !PRESETS[presetName]) {
      console.error(
        `\n❌  Unknown preset "${presetName}". Run --list-presets to see options.\n`,
      );
      process.exit(1);
    }
    const output = generateConfig(PRESETS[presetName]);
    const dryRun = args.includes("--dry-run");
    if (dryRun) {
      printGeneratedConfig(output);
    } else {
      await writeFiles(output, args);
    }
    iface.close();
    return;
  }

  // ── Interactive mode 
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           PWMAF — Auth Config Generator                      ║
║           npx pwmaf init                                     ║
╚══════════════════════════════════════════════════════════════╝

Answer a few questions and we'll generate a ready-to-fly config.
Press Enter to accept the default value shown in (parentheses).
`);

  // ── Auth type
  const authType = await askChoice<AuthType>(
    "1. What authentication type does your app use?",
    [
      "email-password",
      "email-otp",
      "email-password-otp",
      "oauth",
      "oidc",
      "saml",
      "custom",
    ],
    "email-password",
  );

  // ── Browser vs API 
  const browserOnly = ["oauth", "oidc", "saml"].includes(authType);
  let isApi = false;
  if (!browserOnly) {
    isApi = await askYesNo(
      `2. Use direct API calls instead of browser navigation?
   (true = POST credentials directly; false = Playwright navigates the login page)`,
      false,
    );
  } else {
    console.log(
      `\n2. authType "${authType}" requires browser navigation. isApi: false (auto-set).`,
    );
  }

  // ── Config style
  const configStyleInput = await askChoice<"flat" | "users-file">(
    `3. Config style?
   flat       → single user defined inline in base.config.ts (simplest)
   users-file → users defined in users.json, config holds defaults (multi-role)`,
    ["flat", "users-file"],
    "flat",
  );
  const configStyle = configStyleInput as ConfigStyle;

  // ── URLs
  const baseUrl =
    (await ask(
      `4. Base URL of your app (press Enter for http://localhost:3000):`,
    )) || "http://localhost:3000";

  const defaultActionUrl = isApi ? baseUrl : `${baseUrl}/login`;
  const actionUrl =
    (await ask(
      `5. Login URL${isApi ? " (API base URL)" : " (login page URL)"} (press Enter for ${defaultActionUrl}):`,
    )) || defaultActionUrl;

  // ── Provider selection
  let oauthProvider: OAuthProvider | undefined;
  let oidcProvider: OIDCProvider | undefined;
  let samlProvider: SAMLProvider | undefined;

  if (authType === "oauth") {
    oauthProvider = await askChoice<OAuthProvider>(
      "6. OAuth provider?",
      ["google", "github", "microsoft", "facebook"],
      "google",
    );
  }
  if (authType === "oidc") {
    oidcProvider = await askChoice<OIDCProvider>(
      "6. OIDC provider?",
      ["okta", "auth0", "azure-ad", "keycloak", "cognito", "ping"],
      "okta",
    );
  }
  if (authType === "saml") {
    samlProvider = await askChoice<SAMLProvider>(
      "6. SAML provider?",
      ["okta", "azure", "onelogin", "ping", "adfs"],
      "okta",
    );
  }

  // ── OTP settings
  let otpSource: OTPSource | undefined;
  let otpMode: OTPMode | undefined;

  const isOtp = ["email-otp", "email-password-otp"].includes(authType);
  if (isOtp) {
    otpMode = await askChoice<OTPMode>(
      "6. OTP input mode?",
      ["single-input", "segmented"],
      "single-input",
    );
    otpSource = await askChoice<OTPSource>(
      `7. How should the framework get the OTP code?
   env           → read from environment variable (TEST_OTP=...)
   api-intercept → intercept the outbound send-OTP request
   api-request   → call a dedicated test endpoint to fetch it`,
      ["env", "api-intercept", "api-request"],
      "api-request",
    );
  }

  let tokenType: TokenType | undefined;
  if (isApi) {
    tokenType = await askChoice<TokenType>(
      "8. How does your API return the auth token?",
      ["cookie", "bearer", "custom-header"],
      "cookie",
    );
  }

  let includeAdminUser = false;
  if (configStyle === "users-file") {
    includeAdminUser = await askYesNo(
      "Include an admin user example in users.json?",
      true,
    );
  }

  const input: GeneratorInput = {
    authType,
    isApi,
    configStyle,
    baseUrl,
    actionUrl,
    oauthProvider,
    oidcProvider,
    samlProvider,
    otpSource,
    otpMode,
    tokenType,
    includeAdminUser,
  };

  const output = generateConfig(input);

  const preview = await askYesNo(
    "\nPreview the generated config before writing to disk?",
    true,
  );
  if (preview) {
    printGeneratedConfig(output);
  }

  const dryRun = args.includes("--dry-run");
  if (!dryRun) {
    await writeFiles(output, args);
  } else {
    console.log("\n⚠️  --dry-run: files not written.\n");
  }

  iface.close();
}

export async function writeFiles(
  output: ReturnType<any>,
  args: string[],
): Promise<void> {
  const projectRoot = findProjectRoot();

  const outDir = (() => {
    const i = args.indexOf("--out");
    if (i !== -1 && args[i + 1]) {
      return path.resolve(projectRoot, args[i + 1]);
    }
    return projectRoot;
  })();

  fs.mkdirSync(outDir, { recursive: true });

  /**
   * =========================
   * base.config.ts (ROOT ONLY)
   * =========================
   */
  const configPath = path.join(projectRoot, "base.config.ts");
  const configExists = fs.existsSync(configPath);

  let writeConfig = true;

  if (configExists) {
    writeConfig = await askYesNo(
      `[WARN] ${configPath} exists. Overwrite?`,
      false,
    );
  }

  if (writeConfig) {
    fs.writeFileSync(configPath, output.configFile, "utf-8");
    logger.ok(`Written ${configPath}`);
  } else {
    logger.skip(`Skipped ${configPath}`);
  }

  /**
   * =========================
   * users.json (project/data)
   * =========================
   */
  if (output.usersFile) {
    const dataDir = path.join(projectRoot, "data");
    const usersPath = path.join(dataDir, "users.json");

    fs.mkdirSync(dataDir, { recursive: true });

    const exists = fs.existsSync(usersPath);

    let writeUsers = true;

    if (exists) {
      writeUsers = await askYesNo(
        `[WARN] ${usersPath} exists. Overwrite?`,
        false,
      );
    }

    if (writeUsers) {
      fs.writeFileSync(usersPath, output.usersFile, "utf-8");
      logger.ok(`Written ${usersPath}`);
    } else {
      logger.skip(`Skipped ${usersPath}`);
    }
  }

  logger.info("Done. Next steps:");
  logger.info("npx playwright test --project=setup");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
