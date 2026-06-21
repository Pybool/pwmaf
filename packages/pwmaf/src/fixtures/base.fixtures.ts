import { test as base, BrowserContext } from "@playwright/test";
import { BaseFixtures } from "../types";
import { getOrCreateAuthManager } from "../core/AuthManagerInstance";

export const test = base.extend<BaseFixtures>({
  authManager: async ({}, use) => {
    await use(await getOrCreateAuthManager());
  },

  authConfig: async ({ authManager }, use) => {
    await use(authManager.authConfig);
  },

  getUserConfig: async ({ authManager }, use) => {
    await use((username: string) =>
      authManager.getUserEffectiveConfig(username),
    );
  },

  //if feel it s Better to let playwright handle contexts, but if need be here you go
  // Use this only if u want pwmaf to handle token expiration automatically
  getContext: async ({ browser, authManager }, use) => {
    const contexts: BrowserContext[] = [];

    await use(async (username: string) => {
      const context = await authManager.getContext(username, browser);

      contexts.push(context);
      return context;
    });
    //It was embaraasing for me to find out that anything after the "use" middleware was teardown also

    await Promise.allSettled(contexts.map((ctx) => ctx.close()));
  },
});

export { expect } from "@playwright/test";
