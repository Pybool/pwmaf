import {
  Browser,
  chromium,
  firefox,
  FullConfig,
  webkit,
} from "@playwright/test";
import * as dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { authConfig, getOrCreateAuthManager, validateConfig } from "qa-pwmaf";

dotenv.config();

async function validateUserEndpoints() {
  for (const user of authConfig.users) {
    if (!user.actionUrl) {
      throw new Error(`Missing actionUrl for user ${user.username}`);
    }

    try {
      const response = await fetch(user.actionUrl);
      if (!response.ok) {
        throw new Error(`Received ${response.status} from ${user.actionUrl}`);
      }
      console.log(`[globalSetup] ${user.username} -> ${user.actionUrl} [OK]`);
    } catch (error) {
      throw new Error(
        `Failed to reach ${user.actionUrl} for user ${user.username}: ${error}`,
      );
    }
  }
}

export async function deleteAuthStore(folderPath: string): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), folderPath);
  try {
    await fs.rm(absolutePath, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    console.info(`Failed to delete auth store: ${absolutePath}`, error);
  }
}

async function globalSetup(config: FullConfig) {
  const authManager = await getOrCreateAuthManager();
  console.log("authConfig ==> ", authConfig, authManager.authConfig);
  validateConfig(authConfig);

  if (authConfig.deleteAuthStorageOnTestRun) {
    await deleteAuthStore(authConfig.storageStatePath);
  }

  await validateUserEndpoints();
  const project = config.projects[0];

  const browserName =
    (project.use.browserName as "chromium" | "firefox" | "webkit") ??
    "chromium";

  const browserType = {
    chromium,
    firefox,
    webkit,
  }[browserName];

  const browser: Browser = await browserType.launch();

  await authManager.setup(browser);
  await browser.close();
}

export default globalSetup;
