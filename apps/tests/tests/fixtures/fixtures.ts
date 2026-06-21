import { test as base, expect } from "qa-pwmaf";
import type { AuthManager, IAuthConfig, PWContext } from "qa-pwmaf";

type Fixtures = {

  // re-exposed pwmaf fixtures (type-safe passthrough)
  authManager: AuthManager;
  authConfig: IAuthConfig;
  getUserConfig: (username: string) => IAuthConfig;
  getContext: (
    username: string,
    config?: IAuthConfig,
  ) => Promise<PWContext>;
};

export const test = base.extend<Fixtures>({

  /**
   * PASS THROUGH FIXTURES (no override, just expose)
   */
  authManager: async ({ authManager }, use) => {
    await use(authManager);
  },

  authConfig: async ({ authConfig }, use) => {
    await use(authConfig);
  },

  getUserConfig: async ({ getUserConfig }, use) => {
    await use(getUserConfig);
  },

  getContext: async ({ getContext }, use) => {
    await use(getContext);
  },
});

export { expect };